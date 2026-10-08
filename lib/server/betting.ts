// Paris sportifs en pari mutuel (F CFA).
// - Par match et par marché, toutes les mises forment un pot.
// - Au règlement : la maison garde BET_HOUSE_SHARE (10 %), les gagnants se partagent BET_WINNERS_SHARE (90 %) au prorata de leur mise
//   (arrondi au franc inférieur, les centimes restants vont à la maison).
// - Match reporté / annulé : tout le monde est remboursé.
// - Personne n'a misé sur l'issue gagnante, OU tout le monde a misé sur la même issue (pas de perdant) :
//   tout le monde est remboursé, sans commission.
// - Les paris ferment au coup d'envoi.
import { BET_HOUSE_SHARE, BET_MAX_FCFA, BET_MIN_FCFA, BET_ODDS_BLEND_K, BET_WINNERS_SHARE, fromUnits, toUnits, UNIT } from "../config";
import { MARKET_BY_ID, MARKETS, blendWeight, blendedOdds, estimatedOdds, oddsFromProb, selectionLabel, winningSelection } from "../betting";
import { competitionView, getSportsProvider, COMPETITION_BY_ID, COMPETITIONS, type FixtureData, type SportsProvider } from "../sports";
import type { BetStatus, BetView, LiveInfo, MarketId, MarketPool, MatchStatus, MatchView, Selection } from "../types";
import { newId, nowIso, readDb, transact, type BetRow, type Db, type MatchRow } from "./db";
import { AppError } from "./errors";
import { oddsInfo, referenceFor, scheduleOddsRefresh, type Reference } from "./odds";
import { getUser, houseMove, walletMove } from "./wallet";

const DAY = 86400000;
const PAST_DAYS = 3; // matchs terminés affichés
const FUTURE_DAYS = 14; // matchs à venir synchronisés
const KEEP_DAYS = 30; // les matchs sans pari plus vieux que ça sont purgés

// ------------------------------------------------------------------ synchronisation
let inflight: Promise<void> | null = null;

/** Met à jour la copie locale des matchs depuis le fournisseur (au plus une fois par intervalle) puis règle les matchs terminés. */
export async function ensureSynced(force = false): Promise<void> {
  await syncMatches(force);
  // Direct (API-Football) : 1 requête pour les matchs en cours, espacée selon le quota restant.
  try {
    await syncLive();
  } catch {
    /* le direct est un bonus : la synchro complète prend le relais */
  }
  // Cotes bookmakers : rafraîchies en arrière-plan quand le cache est périmé (jamais à chaque page vue).
  try {
    void scheduleOddsRefresh();
  } catch {
    /* les cotes calculées prennent le relais */
  }
}

async function syncMatches(force: boolean): Promise<void> {
  const provider = getSportsProvider();
  const db = readDb();
  const last = db.sports.lastSyncAt ? Date.parse(db.sports.lastSyncAt) : 0;
  const fresh = db.sports.provider === provider.id && Date.now() - last < provider.syncIntervalMs;
  if (fresh && !force) {
    if (db.matches.some((m) => isSettleable(m))) transact((d) => settleDue(d));
    return;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    const now = Date.now();
    const from = new Date(now - PAST_DAYS * DAY);
    const to = new Date(now + FUTURE_DAYS * DAY);
    try {
      const fixtures = await provider.fetchFixtures(from, to);
      transact((d) => {
        const stamp = nowIso();
        const byId = new Map(d.matches.map((m) => [m.id, m]));
        for (const f of fixtures) {
          if (!COMPETITION_BY_ID[f.competitionId]) continue;
          const id = `${provider.id === "demo" ? "demo" : "af"}:${f.externalId}`;
          const existing = byId.get(id);
          if (existing?.manual) continue;
          if (existing?.settledAt) {
            // match réglé : on ne touche plus au résultat, mais on complète l'affichage (buteurs, mi-temps…)
            if (f.live && sameResult(existing, f)) existing.live = mergeLive(existing.live, f);
            continue;
          }
          const row: MatchRow = {
            id,
            source: provider.id,
            competitionId: f.competitionId,
            home: f.home,
            away: f.away,
            homeLogo: f.homeLogo,
            awayLogo: f.awayLogo,
            kickoff: f.kickoff,
            status: f.status,
            score: f.score,
            live: f.live ? mergeLive(existing?.live, f) : undefined,
            round: f.round,
            venue: f.venue,
            updatedAt: stamp,
          };
          if (existing) Object.assign(existing, row);
          else {
            d.matches.push(row);
            byId.set(id, row);
          }
        }
        // purge des vieux matchs sans pari
        const withBets = new Set(d.bets.map((b) => b.matchId));
        d.matches = d.matches.filter((m) => withBets.has(m.id) || Date.parse(m.kickoff) > now - KEEP_DAYS * DAY);
        d.sports = { ...d.sports, provider: provider.id, lastSyncAt: stamp, lastError: undefined };
        recordQuota(d, provider);
        settleDue(d);
      });
    } catch (e) {
      transact((d) => {
        d.sports = { ...d.sports, provider: provider.id, lastSyncAt: nowIso(), lastError: (e as Error).message };
        recordQuota(d, provider);
        settleDue(d);
      });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// ------------------------------------------------------------------ direct
const LIVE_WINDOW_MS = 4 * 3600 * 1000; // un match commencé il y a plus de 4 h est laissé à la synchro complète
const MATCH_SPAN_MS = 2 * 3600 * 1000; // durée approximative d'un match (pauses comprises)
let liveInflight: Promise<void> | null = null;

const goalTally = (live?: LiveInfo) => (live?.events ?? []).filter((e) => e.type === "goal" || e.type === "penalty" || e.type === "own-goal").length;

/** Fusionne les nouvelles infos en direct avec les précédentes (la liste par compétition ne contient pas les buteurs). */
function mergeLive(prev: LiveInfo | undefined, f: FixtureData): LiveInfo | undefined {
  const next = f.live;
  if (!next) return prev;
  if (prev && prev.events.length > 0 && (f.eventsIncluded === false || next.events.length === 0)) {
    const total = next.goals ? next.goals.home + next.goals.away : 0;
    if (total >= goalTally(prev)) return { ...next, events: prev.events };
  }
  return next;
}

function sameResult(m: MatchRow, f: FixtureData) {
  if (m.status !== f.status) return false;
  if (!m.score || !f.score) return m.score == null && f.score == null;
  return m.score.home === f.score.home && m.score.away === f.score.away;
}

const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Ajoute au compteur du jour les requêtes faites par le fournisseur (et les valeurs des en-têtes de quota). */
function recordQuota(d: Db, provider: SportsProvider) {
  const snap = provider.takeQuota?.();
  if (!snap) return;
  const day = utcDay(Date.now());
  const q = d.sports.quota?.day === day ? d.sports.quota : { day, used: 0 };
  q.used += snap.requests;
  if (snap.remaining != null) q.remaining = snap.remaining;
  if (snap.limit != null) q.limit = snap.limit;
  d.sports.quota = q;
}

/** Requêtes restantes aujourd'hui (en-tête de l'API si connu, sinon quota configuré - requêtes comptées). */
export function quotaState(db: Db, now = Date.now()) {
  const day = utcDay(now);
  const q = db.sports.quota?.day === day ? db.sports.quota : { day, used: 0, remaining: null, limit: null };
  const limit = q.limit ?? (Number(process.env.API_FOOTBALL_DAILY_LIMIT) > 0 ? Number(process.env.API_FOOTBALL_DAILY_LIMIT) : 100);
  const remaining = q.remaining ?? Math.max(0, limit - q.used);
  return { day, used: q.used, limit, remaining };
}

/**
 * Délai minimal entre deux rafraîchissements du direct : l'intervalle de base (60 s par défaut), allongé pour que
 * les requêtes restantes du jour (moins une réserve pour les synchros complètes) couvrent la fin des matchs du jour.
 * Exemple offre gratuite (100/jour) : ~15 à 30 min un samedi chargé, ~2 à 5 min un soir de Ligue des champions.
 */
export function liveRefreshDelay(db: Db, provider: SportsProvider, now = Date.now()): number {
  const base = provider.liveIntervalMs ?? 60_000;
  const { remaining } = quotaState(db, now);
  const endOfDay = Date.parse(utcDay(now) + "T00:00:00Z") + DAY;
  const last = db.sports.lastSyncAt ? Date.parse(db.sports.lastSyncAt) : now;
  let nextFull = Math.max(now, last + provider.syncIntervalMs);
  let fullLeft = 0;
  for (; nextFull < endOfDay; nextFull += provider.syncIntervalMs) fullLeft++;
  const usable = remaining - fullLeft * COMPETITIONS.length - 2;
  if (usable <= 0) return Infinity;
  let lastEnd = now;
  for (const m of db.matches) {
    const k = Date.parse(m.kickoff);
    if (m.source === provider.id && k > now - LIVE_WINDOW_MS && k < endOfDay) lastEnd = Math.max(lastEnd, Math.min(endOfDay, k + MATCH_SPAN_MS));
  }
  return Math.max(base, (lastEnd - now) / usable);
}

function liveCandidates(db: Db, providerId: string, now: number) {
  return db.matches.filter((m) => {
    if (m.source !== providerId || m.settledAt || m.manual) return false;
    if (m.status !== "live" && m.status !== "scheduled") return false;
    const k = Date.parse(m.kickoff);
    return k <= now && k > now - LIVE_WINDOW_MS;
  });
}

/** Rafraîchit le direct des matchs en cours (fournisseurs qui le permettent), dans la limite du quota. */
async function syncLive(): Promise<void> {
  const provider = getSportsProvider();
  if (!provider.fetchLive) return;
  const db = readDb();
  const now = Date.now();
  const candidates = liveCandidates(db, provider.id, now);
  if (candidates.length === 0) return;
  const last = db.sports.lastLiveAt ? Date.parse(db.sports.lastLiveAt) : 0;
  if (now - last < liveRefreshDelay(db, provider, now)) return;
  if (liveInflight) return liveInflight;
  liveInflight = (async () => {
    try {
      const fixtures = await provider.fetchLive!(candidates.map((m) => m.id.replace(/^af:/, "")));
      transact((d) => {
        const byId = new Map(d.matches.map((m) => [m.id, m]));
        const stamp = nowIso();
        for (const f of fixtures) {
          const m = byId.get(`af:${f.externalId}`);
          if (!m || m.manual || m.settledAt) continue;
          Object.assign(m, { status: f.status, score: f.score, live: f.live ? mergeLive(m.live, f) : m.live, updatedAt: stamp });
        }
        d.sports = { ...d.sports, lastLiveAt: stamp, lastLiveError: undefined };
        recordQuota(d, provider);
        settleDue(d);
      });
    } catch (e) {
      transact((d) => {
        d.sports = { ...d.sports, lastLiveAt: nowIso(), lastLiveError: (e as Error).message };
        recordQuota(d, provider);
      });
    } finally {
      liveInflight = null;
    }
  })();
  return liveInflight;
}

// ------------------------------------------------------------------ règlement
function isSettleable(m: MatchRow) {
  if (m.settledAt) return false;
  if (m.status === "postponed" || m.status === "cancelled") return true;
  return m.status === "finished" && m.score != null;
}

function settleDue(db: Db) {
  for (const m of db.matches) if (isSettleable(m)) settleMatch(db, m);
}

const floorFranc = (units: number) => Math.floor(units / UNIT) * UNIT;

function refund(db: Db, m: MatchRow, bets: BetRow[], note: string) {
  for (const b of bets) {
    b.status = "refunded";
    b.payout = b.stake;
    b.note = note;
    b.settledAt = nowIso();
    walletMove(db, getUser(db, b.userId), "fcfa", b.stake, "remboursement_pari", `Remboursement pari – ${m.home} - ${m.away}`, undefined, { matchId: m.id });
  }
}

export function settleMatch(db: Db, m: MatchRow) {
  if (m.settledAt) return;
  const label = `${m.home} - ${m.away}`;
  m.settlement = {};
  for (const def of MARKETS) {
    const bets = db.bets.filter((b) => b.matchId === m.id && b.market === def.id && b.status === "pending");
    const pool = bets.reduce((a, b) => a + b.stake, 0);
    if (m.status === "postponed" || m.status === "cancelled") {
      const reason = m.status === "postponed" ? "Match reporté : mise remboursée" : "Match annulé : mise remboursée";
      refund(db, m, bets, reason);
      m.settlement[def.id] = { winner: null, pool, commission: 0, refunded: true, reason };
      continue;
    }
    const winner = winningSelection(def.id, m.score!);
    const winners = bets.filter((b) => b.selection === winner);
    const winnersTotal = winners.reduce((a, b) => a + b.stake, 0);
    if (bets.length === 0) {
      m.settlement[def.id] = { winner, pool: 0, commission: 0, refunded: false };
      continue;
    }
    if (winnersTotal === 0 || winnersTotal === pool) {
      const reason = winnersTotal === 0 ? "Personne n'a misé sur l'issue gagnante : mise remboursée" : "Aucun perdant sur ce marché : mise remboursée";
      refund(db, m, bets, reason);
      m.settlement[def.id] = { winner, pool, commission: 0, refunded: true, reason };
      continue;
    }
    const distributable = Math.floor(pool * BET_WINNERS_SHARE);
    let paid = 0;
    for (const b of bets) {
      b.settledAt = nowIso();
      if (b.selection === winner) {
        const payout = floorFranc(Math.floor((b.stake * distributable) / winnersTotal));
        b.status = "won";
        b.payout = payout;
        paid += payout;
        walletMove(db, getUser(db, b.userId), "fcfa", payout, "gain_pari", `Gain pari – ${label} (${selectionLabel(def.id, winner, m.home, m.away)})`, undefined, { matchId: m.id });
      } else {
        b.status = "lost";
        b.payout = 0;
      }
    }
    const commission = pool - paid;
    houseMove(db, "fcfa", commission, "commission_pari", `Commission ${Math.round(BET_HOUSE_SHARE * 100)} % pari mutuel – ${label} (${def.short})`, undefined, m.id);
    m.settlement[def.id] = { winner, pool, commission, refunded: false };
  }
  m.settledAt = nowIso();
}

// ------------------------------------------------------------------ vues
function displayStatus(m: MatchRow, now = Date.now()): MatchStatus {
  if (m.status === "scheduled" && now >= Date.parse(m.kickoff)) return "live";
  return m.status;
}

export function isBettingOpen(m: MatchRow, now = Date.now()) {
  return !m.settledAt && m.status === "scheduled" && now < Date.parse(m.kickoff);
}

/** Probabilité de référence (sans marge) d'une issue. */
function refProbOf(ref: Reference, market: MarketId, sel: Selection): number {
  return ref.probs[market]?.[sel] ?? 1 / (MARKET_BY_ID[market]?.outcomes.length ?? 2);
}

function marketPools(db: Db, m: MatchRow, ref: Reference, only?: MarketId[]): MarketPool[] {
  const bets = db.bets.filter((b) => b.matchId === m.id);
  return MARKETS.filter((d) => !only || only.includes(d.id)).map((d) => {
    const mb = bets.filter((b) => b.market === d.id);
    const total = fromUnits(mb.reduce((a, b) => a + b.stake, 0));
    return {
      market: d.id,
      label: d.label,
      total,
      winner: m.settlement?.[d.id]?.winner ?? undefined,
      refSource: ref.marketSource[d.id],
      blendWeight: Math.round(blendWeight(total, BET_ODDS_BLEND_K) * 1000) / 1000,
      blendK: BET_ODDS_BLEND_K,
      outcomes: d.outcomes.map((o) => {
        const ob = mb.filter((b) => b.selection === o.selection);
        const ot = fromUnits(ob.reduce((a, b) => a + b.stake, 0));
        const refProb = refProbOf(ref, d.id, o.selection);
        const pool = total - ot > 0 ? estimatedOdds(total, ot, BET_WINNERS_SHARE) : null;
        return {
          selection: o.selection,
          label: selectionLabel(d.id, o.selection, m.home, m.away),
          total: ot,
          bets: ob.length,
          odds: blendedOdds(refProb, total, ot, BET_WINNERS_SHARE, BET_ODDS_BLEND_K),
          refProb: Math.round(refProb * 10000) / 10000,
          refOdds: oddsFromProb(refProb, BET_WINNERS_SHARE),
          poolOdds: pool == null ? null : Math.round(pool * 100) / 100,
        };
      }),
    };
  });
}

export function matchView(db: Db, m: MatchRow, only?: MarketId[]): MatchView {
  const ref = referenceFor(db, m);
  return {
    id: m.id,
    competitionId: m.competitionId,
    competition: competitionView(m.competitionId),
    home: m.home,
    away: m.away,
    homeLogo: m.homeLogo,
    awayLogo: m.awayLogo,
    kickoff: m.kickoff,
    status: displayStatus(m),
    score: m.score,
    live: m.manual ? null : (m.live ?? null),
    round: m.round,
    venue: m.venue,
    source: m.manual ? "manuel" : m.source,
    bettingOpen: isBettingOpen(m),
    settled: !!m.settledAt,
    totalPool: fromUnits(db.bets.filter((b) => b.matchId === m.id).reduce((a, b) => a + b.stake, 0)),
    markets: marketPools(db, m, ref, only),
    odds: { source: ref.source, books: ref.books, updatedAt: ref.updatedAt },
  };
}

export function providerInfo(db: Db) {
  const p = getSportsProvider();
  const now = Date.now();
  const live = p.fetchLive
    ? {
        lastLiveAt: db.sports.lastLiveAt ?? null,
        lastLiveError: db.sports.lastLiveError ?? null,
        quota: quotaState(db, now),
        // délai actuel entre deux rafraîchissements du direct (null = quota du jour épuisé)
        refreshMs: (() => {
          const ms = liveRefreshDelay(db, p, now);
          return Number.isFinite(ms) ? Math.round(ms) : null;
        })(),
      }
    : { lastLiveAt: db.sports.lastSyncAt ?? null, lastLiveError: null, quota: null, refreshMs: p.syncIntervalMs };
  return { id: p.id, label: p.label, isDemo: p.isDemo, lastSyncAt: db.sports.lastSyncAt ?? null, lastError: db.sports.lastError ?? null, odds: oddsInfo(db), live };
}

export interface MyMatchBets {
  bets: number;
  stake: number;
  payout: number;
  /** Synthèse : gagné si au moins un pari gagné, sinon en cours, sinon remboursé, sinon perdu. */
  status: BetStatus;
}

/** Résumé des paris d'un joueur par match (badges « gagné / perdu / remboursé » de l'onglet Résultats). */
function myBetsByMatch(db: Db, userId: string): Record<string, MyMatchBets> {
  const out: Record<string, MyMatchBets & { set: Set<BetStatus> }> = {};
  for (const b of db.bets) {
    if (b.userId !== userId) continue;
    const s = (out[b.matchId] ??= { bets: 0, stake: 0, payout: 0, status: "lost", set: new Set() });
    s.bets++;
    s.stake += b.stake;
    s.payout += b.payout;
    s.set.add(b.status);
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, { set, ...s }]) => [
      k,
      {
        ...s,
        stake: fromUnits(s.stake),
        payout: fromUnits(s.payout),
        status: set.has("won") ? "won" : set.has("pending") ? "pending" : set.has("refunded") && !set.has("lost") ? "refunded" : "lost",
      },
    ]),
  );
}

/** Liste des matchs (marché 1N2 seulement, pour alléger) : à venir / en cours / terminés récemment. */
export function listMatches(userId?: string | null) {
  const db = readDb();
  const now = Date.now();
  const matches = db.matches
    .filter((m) => Date.parse(m.kickoff) > now - PAST_DAYS * DAY && Date.parse(m.kickoff) < now + FUTURE_DAYS * DAY)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .map((m) => matchView(db, m, ["1N2"]));
  const ids = new Set(matches.map((m) => m.id));
  const mine = userId ? Object.fromEntries(Object.entries(myBetsByMatch(db, userId)).filter(([k]) => ids.has(k))) : {};
  return { provider: providerInfo(db), matches, mine, serverTime: new Date(now).toISOString() };
}

function betView(db: Db, b: BetRow): BetView {
  const m = db.matches.find((x) => x.id === b.matchId);
  const def = MARKET_BY_ID[b.market];
  let estimatedPayout: number | null = null;
  if (b.status === "pending") {
    const mb = db.bets.filter((x) => x.matchId === b.matchId && x.market === b.market);
    const total = mb.reduce((a, x) => a + x.stake, 0);
    const ot = mb.filter((x) => x.selection === b.selection).reduce((a, x) => a + x.stake, 0);
    // même cote que celle affichée (estimation) ; sans mise adverse, la règle de remboursement s'applique
    const odds = m ? blendedOdds(refProbOf(referenceFor(db, m), b.market, b.selection), fromUnits(total), fromUnits(ot), BET_WINNERS_SHARE, BET_ODDS_BLEND_K) : null;
    estimatedPayout = total - ot === 0 || odds == null ? fromUnits(b.stake) : Math.floor(fromUnits(b.stake) * odds);
  }
  return {
    id: b.id,
    matchId: b.matchId,
    match: m
      ? { home: m.home, away: m.away, kickoff: m.kickoff, status: displayStatus(m), score: m.score, competition: competitionView(m.competitionId).name }
      : { home: "?", away: "?", kickoff: b.createdAt, status: "cancelled", score: null, competition: "" },
    market: b.market,
    marketLabel: def?.label ?? b.market,
    selection: b.selection,
    selectionLabel: m ? selectionLabel(b.market, b.selection, m.home, m.away) : b.selection,
    stake: fromUnits(b.stake),
    status: b.status,
    payout: fromUnits(b.payout),
    estimatedPayout,
    note: b.note,
    createdAt: b.createdAt,
    settledAt: b.settledAt,
  };
}

export function getMatch(id: string, userId: string | null) {
  const db = readDb();
  const m = db.matches.find((x) => x.id === id);
  if (!m) throw new AppError(404, "Match introuvable.");
  const myBets = userId ? db.bets.filter((b) => b.matchId === id && b.userId === userId).reverse().map((b) => betView(db, b)) : [];
  return { match: matchView(db, m), myBets, provider: providerInfo(db) };
}

export function myBets(userId: string): BetView[] {
  const db = readDb();
  return db.bets.filter((b) => b.userId === userId).reverse().map((b) => betView(db, b));
}

// ------------------------------------------------------------------ prise de pari
export function placeBet(userId: string, body: Record<string, unknown>) {
  const matchId = String(body.matchId ?? "");
  const market = String(body.market ?? "") as MarketId;
  const selection = String(body.selection ?? "") as Selection;
  const stake = Number(body.stake);
  const def = MARKET_BY_ID[market];
  if (!def) throw new AppError(400, "Marché inconnu.");
  if (!def.outcomes.some((o) => o.selection === selection)) throw new AppError(400, "Choix invalide pour ce marché.");
  if (!Number.isInteger(stake) || stake < BET_MIN_FCFA || stake > BET_MAX_FCFA)
    throw new AppError(400, `La mise doit être un nombre entier entre ${BET_MIN_FCFA.toLocaleString("fr-FR")} et ${BET_MAX_FCFA.toLocaleString("fr-FR")} F CFA.`);
  return transact((db) => {
    const u = getUser(db, userId);
    const m = db.matches.find((x) => x.id === matchId);
    if (!m) throw new AppError(404, "Match introuvable.");
    if (!isBettingOpen(m)) throw new AppError(400, "Les paris sont fermés pour ce match (coup d'envoi passé ou match réglé).");
    if (u.fcfa < toUnits(stake)) throw new AppError(400, "Solde F CFA insuffisant. Faites un dépôt ou convertissez des Lions.");
    const bet: BetRow = { id: newId("bet_"), userId, matchId, market, selection, stake: toUnits(stake), status: "pending", payout: 0, createdAt: nowIso() };
    db.bets.push(bet);
    walletMove(db, u, "fcfa", -bet.stake, "pari", `Pari ${def.short} – ${m.home} - ${m.away} : ${selectionLabel(market, selection, m.home, m.away)}`, undefined, { matchId });
    return { bet: betView(db, bet), user: u, match: matchView(db, m) };
  });
}

// ------------------------------------------------------------------ administration
export function adminOverview() {
  const db = readDb();
  const now = Date.now();
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const commission = sum(db.house.ledger.filter((l) => l.type === "commission_pari").map((l) => l.amount));
  const pendingBets = db.bets.filter((b) => b.status === "pending");
  const matches = db.matches
    .filter((m) => db.bets.some((b) => b.matchId === m.id) || (Date.parse(m.kickoff) > now - PAST_DAYS * DAY && Date.parse(m.kickoff) < now + 7 * DAY))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .map((m) => ({
      ...matchView(db, m),
      betsCount: db.bets.filter((b) => b.matchId === m.id).length,
      commission: fromUnits(sum(db.house.ledger.filter((l) => l.matchId === m.id && l.type === "commission_pari").map((l) => l.amount))),
      settlement: m.settlement
        ? Object.fromEntries(
            Object.entries(m.settlement).map(([k, s]) => [k, { ...s, pool: fromUnits(s!.pool), commission: fromUnits(s!.commission) }]),
          )
        : null,
    }));
  return {
    provider: providerInfo(db),
    stats: {
      commission: fromUnits(commission),
      houseFcfa: fromUnits(db.house.fcfa),
      pendingStakes: fromUnits(sum(pendingBets.map((b) => b.stake))),
      pendingBets: pendingBets.length,
      totalBets: db.bets.length,
      deposits: fromUnits(sum(db.payments.filter((p) => p.kind === "depot" && p.status === "completed").map((p) => p.amount))),
      withdrawals: fromUnits(sum(db.payments.filter((p) => p.kind === "retrait" && p.status === "completed").map((p) => p.amount))),
    },
    matches,
  };
}

function parseGoals(v: unknown) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 30) throw new AppError(400, "Score invalide.");
  return n;
}

/** Fixe le score final (ou le statut reporté / annulé) d'un match et règle les paris. */
export function adminSetResult(matchIdRaw: unknown, body: Record<string, unknown>) {
  return transact((db) => {
    const m = db.matches.find((x) => x.id === matchIdRaw);
    if (!m) throw new AppError(404, "Match introuvable.");
    if (m.settledAt) throw new AppError(400, "Ce match est déjà réglé.");
    const status = String(body.status ?? "finished");
    if (status === "finished") {
      m.score = { home: parseGoals(body.home), away: parseGoals(body.away) };
      m.status = "finished";
    } else if (status === "postponed" || status === "cancelled") {
      m.status = status;
      m.score = null;
    } else throw new AppError(400, "Statut inconnu.");
    m.manual = true;
    m.updatedAt = nowIso();
    settleMatch(db, m);
    return matchView(db, m);
  });
}
