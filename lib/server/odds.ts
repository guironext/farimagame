// Cotes de référence d'un match : vraies cotes bookmakers (The Odds API) si disponibles, sinon cotes FarimaGame
// calculées (lib/odds/model.ts). Les réponses de The Odds API sont gardées en cache dans data/db.json
// (clé "oddsApi") : l'API n'est JAMAIS appelée à chaque affichage de page.
//
// Activation : ODDS_API_KEY=… dans .env.local, puis relancer `npm run dev`.
// Options (facultatives) :
//   ODDS_API_REFRESH_MINUTES=15     délai minimal entre deux rafraîchissements (défaut 15 min)
//   ODDS_API_LOOKAHEAD_DAYS=7       ne demande que les compétitions ayant un match ouvert dans ce délai
//   ODDS_API_SPORTS="wcq-afr=…"     ajoute / remplace des clés de sport (voir lib/odds/oddsApi.ts)
//   ODDS_API_REGIONS=eu             régions de bookmakers (chaque région ajoutée multiplie le coût)
//   ODDS_API_WITH_DEMO=1            interroge l'API même avec les matchs de démonstration (inutile : ils sont fictifs)
//   ODDS_API_BASE_URL=…             (défaut https://api.the-odds-api.com, utile pour les tests)
//
// Quota : chaque appel coûte 2 crédits (h2h + totals, 1 région) par compétition. Après chaque
// rafraîchissement, le prochain est planifié pour répartir les crédits restants (en-tête
// x-requests-remaining) jusqu'à la fin du mois : intervalle = max(minimum, temps restant ÷ rafraîchissements
// possibles). Avec l'offre gratuite (500 crédits/mois) et ~8 compétitions, cela fait environ un
// rafraîchissement par jour ; avec une offre payante, toutes les 15 minutes.
import type { MarketId } from "../types";
import { probsFromGoals, modelForMatch, type MarketProbs } from "../odds/model";
import { ODDS_API_MARKETS, findEventFor, oddsApiUrl, parseOddsResponse, sportKeys, type OddsEvent } from "../odds/oddsApi";
import { getSportsProvider } from "../sports";
import { nowIso, readDb, transact, type Db, type MatchRow } from "./db";

export interface OddsCache {
  events: OddsEvent[];
  fetchedAt?: string;
  nextAt?: string;
  remaining?: number | null;
  used?: number | null;
  lastError?: string | null;
  status?: string;
  sports?: string[];
}

const DAY = 86400000;
const envNum = (name: string, def: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
};

export const oddsApiEnabled = () => !!process.env.ODDS_API_KEY?.trim();

export type RefSource = "bookmakers" | "modele";

export interface Reference {
  source: "bookmakers" | "farimagame";
  books?: number;
  updatedAt?: string;
  probs: MarketProbs;
  marketSource: Record<MarketId, RefSource>;
}

/** Cotes de référence (probabilités sans marge) d'un match. Déterministe pour un même cache. */
export function referenceFor(db: Db, m: MatchRow): Reference {
  const ev = oddsApiEnabled() && db.oddsApi?.events?.length ? findEventFor(db.oddsApi.events, m) : null;
  if (ev) {
    const fitted = probsFromGoals(ev.lh, ev.la);
    const hasTotals = ev.fair.plus != null;
    return {
      source: "bookmakers",
      books: ev.books,
      updatedAt: db.oddsApi?.fetchedAt,
      probs: {
        "1N2": { "1": ev.fair["1"], N: ev.fair.N, "2": ev.fair["2"] },
        OU25: hasTotals ? { plus: ev.fair.plus!, moins: 1 - ev.fair.plus! } : fitted.OU25,
        BTTS: fitted.BTTS, // non fourni par l'offre de base : déduit des buts attendus calés sur les bookmakers
      },
      marketSource: { "1N2": "bookmakers", OU25: hasTotals ? "bookmakers" : "modele", BTTS: "modele" },
    };
  }
  return { source: "farimagame", probs: modelForMatch(m).probs, marketSource: { "1N2": "modele", OU25: "modele", BTTS: "modele" } };
}

// ------------------------------------------------------------------ rafraîchissement du cache
let inflight: Promise<void> | null = null;

function startOfNextMonth(now: number) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

async function setCache(patch: Partial<OddsCache>) {
  await transact((d) => {
    d.oddsApi = { events: [], ...(d.oddsApi ?? {}), ...patch };
  });
}

/**
 * Lance (en arrière-plan) un rafraîchissement des cotes bookmakers si le cache est périmé.
 * Ne fait rien sans ODDS_API_KEY. Renvoie la promesse en cours (utile pour les tests), sinon null.
 */
export async function scheduleOddsRefresh(): Promise<void | null> {
  const key = process.env.ODDS_API_KEY?.trim();
  if (!key) return null;
  if (inflight) return inflight;
  const db = await readDb();
  const now = Date.now();
  const cache = db.oddsApi;
  if (cache?.nextAt && now < Date.parse(cache.nextAt)) return null;

  if (getSportsProvider().isDemo && process.env.ODDS_API_WITH_DEMO !== "1") {
    setCache({
      status: "Clé The Odds API détectée, mais les matchs affichés sont des matchs de démonstration (fictifs) : aucune cote bookmaker ne peut leur correspondre. Ajoutez API_FOOTBALL_KEY pour les vrais matchs.",
      nextAt: new Date(now + 3600 * 1000).toISOString(),
    });
    return null;
  }

  const sports = sportKeys();
  const lookahead = envNum("ODDS_API_LOOKAHEAD_DAYS", 7) * DAY;
  const wanted = [
    ...new Set(
      db.matches
        .filter((m) => !m.settledAt && m.status === "scheduled" && Date.parse(m.kickoff) > now && Date.parse(m.kickoff) < now + lookahead)
        .map((m) => sports[m.competitionId])
        .filter((s): s is string => !!s),
    ),
  ].sort();
  if (wanted.length === 0) {
    setCache({ status: "Aucun match à venir couvert par The Odds API.", nextAt: new Date(now + 10 * 60 * 1000).toISOString() });
    return null;
  }

  const base = process.env.ODDS_API_BASE_URL ?? "https://api.the-odds-api.com";
  const minMs = envNum("ODDS_API_REFRESH_MINUTES", 15) * 60 * 1000;
  const costPerCall = ODDS_API_MARKETS.split(",").length * (process.env.ODDS_API_REGIONS ?? "eu").split(",").length;

  setCache({ nextAt: new Date(now + 2 * 60 * 1000).toISOString() }); // verrou : évite deux rafraîchissements simultanés
  inflight = (async () => {
    const fresh = new Map<string, OddsEvent[]>();
    const errors: string[] = [];
    let remaining: number | null = cache?.remaining ?? null;
    let used: number | null = cache?.used ?? null;
    for (const sport of wanted) {
      if (remaining != null && remaining < costPerCall) {
        errors.push("quota The Odds API épuisé");
        break;
      }
      try {
        const res = await fetch(oddsApiUrl(base, sport, key), { cache: "no-store", signal: AbortSignal.timeout(15000) });
        const rem = Number(res.headers.get("x-requests-remaining"));
        const usd = Number(res.headers.get("x-requests-used"));
        if (res.headers.has("x-requests-remaining") && Number.isFinite(rem)) remaining = rem;
        if (res.headers.has("x-requests-used") && Number.isFinite(usd)) used = usd;
        if (!res.ok) {
          let msg = "";
          try {
            msg = String(((await res.json()) as { message?: string }).message ?? "");
          } catch {
            /* ignore */
          }
          errors.push(`${sport} : HTTP ${res.status}${msg ? ` (${msg})` : ""}`);
          if (res.status === 401 || res.status === 429) break; // clé invalide / quota : inutile d'insister
          continue;
        }
        fresh.set(sport, parseOddsResponse(await res.json(), sport));
      } catch (e) {
        errors.push(`${sport} : ${(e as Error).name === "TimeoutError" ? "délai dépassé" : (e as Error).message}`);
      }
    }

    const t = Date.now();
    let nextMs = minMs;
    if (fresh.size === 0) nextMs = Math.max(minMs, 30 * 60 * 1000); // échec complet : on réessaie dans 30 min
    if (remaining != null) {
      const costPerRefresh = wanted.length * costPerCall;
      const refreshesLeft = Math.floor(remaining / costPerRefresh);
      const untilReset = startOfNextMonth(t) - t;
      nextMs = refreshesLeft <= 0 ? untilReset : Math.max(nextMs, untilReset / refreshesLeft);
    }

    await transact((d) => {
      const prev = d.oddsApi?.events ?? [];
      const keep = prev.filter((e) => {
        if (Date.parse(e.commence) < t - 3 * DAY) return false; // trop vieux
        if (!fresh.has(e.sport)) return true; // compétition non rafraîchie : on garde
        // match déjà commencé (absent de la nouvelle réponse) : on fige ses dernières cotes d'avant-match
        return Date.parse(e.commence) <= t && !fresh.get(e.sport)!.some((n) => n.id === e.id);
      });
      const events = [...keep, ...[...fresh.values()].flat()];
      d.oddsApi = {
        events,
        fetchedAt: fresh.size > 0 ? nowIso() : d.oddsApi?.fetchedAt,
        nextAt: new Date(t + nextMs).toISOString(),
        remaining,
        used,
        lastError: errors.length ? errors.join(" ; ") : null,
        status: fresh.size > 0 ? `${events.length} match(s) avec cotes bookmakers en cache (${[...fresh.keys()].length} compétition(s)).` : "Échec de la récupération des cotes bookmakers.",
        sports: wanted,
      };
    });
  })()
    .catch((e) => {
      setCache({ lastError: (e as Error).message, nextAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Résumé pour l'admin et l'API publique (sans la clé). */
export function oddsInfo(db: Db) {
  const c = db.oddsApi;
  return {
    enabled: oddsApiEnabled(),
    provider: oddsApiEnabled() ? "The Odds API" : "Modèle FarimaGame",
    status: oddsApiEnabled() ? (c?.status ?? "En attente du premier rafraîchissement.") : "Pas de clé ODDS_API_KEY : cotes calculées par FarimaGame.",
    fetchedAt: c?.fetchedAt ?? null,
    nextAt: c?.nextAt ?? null,
    remaining: c?.remaining ?? null,
    events: c?.events?.length ?? 0,
    lastError: oddsApiEnabled() ? (c?.lastError ?? null) : null,
  };
}
