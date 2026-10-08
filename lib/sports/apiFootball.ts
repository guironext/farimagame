// Fournisseur RÉEL : API-Football (https://www.api-football.com, hébergé sur api-sports.io).
// Activé automatiquement quand la variable d'environnement API_FOOTBALL_KEY est définie.
//   API_FOOTBALL_KEY=xxxxxxxx npm run dev
// Options :
//   API_FOOTBALL_SEASON=2026            force la saison (sinon calculée selon la compétition)
//   API_FOOTBALL_LEAGUES="ci-ligue1=386,canq=36"   remplace des identifiants de compétitions
//   API_FOOTBALL_BASE_URL=...           (par défaut https://v3.football.api-sports.io)
//   API_FOOTBALL_SYNC_MINUTES=360       intervalle entre deux synchronisations complètes (12 requêtes chacune)
//   API_FOOTBALL_LIVE_SECONDS=60        intervalle de base du direct (1 requête pour 20 matchs en cours)
//   API_FOOTBALL_DAILY_LIMIT=100        quota quotidien de votre offre (sinon lu dans les en-têtes de réponse)
//
// Requêtes :
//   - synchronisation complète = 1 requête par compétition (12), toutes les API_FOOTBALL_SYNC_MINUTES ;
//   - direct = GET /fixtures?ids=a-b-c (20 matchs max par requête, avec buts, cartons, mi-temps), seulement
//     quand un de NOS matchs est en cours, et espacé automatiquement pour ne pas dépasser le quota du jour
//     (voir liveRefreshDelay dans lib/server/betting.ts).
// L'offre gratuite d'API-Football est limitée à 100 requêtes/jour : le direct y est donc rafraîchi
// toutes les quelques minutes au lieu de chaque minute.
import type { LiveInfo, MatchEvent, MatchEventType, MatchPeriod, MatchStatus, ScorePair } from "../types";
import { COMPETITIONS, type Competition } from "./competitions";
import type { FixtureData, QuotaSnapshot, SportsProvider } from "./types";

type Pair = { home: number | null; away: number | null } | null | undefined;

interface ApiEvent {
  time: { elapsed: number | null; extra?: number | null };
  team: { id: number; name?: string };
  player?: { id?: number | null; name?: string | null } | null;
  assist?: { id?: number | null; name?: string | null } | null;
  type: string; // "Goal" | "Card" | "subst" | "Var"
  detail?: string | null; // "Normal Goal" | "Own Goal" | "Penalty" | "Missed Penalty" | "Yellow Card" | "Red Card" | "Second Yellow card"…
  comments?: string | null; // ex. "Penalty Shootout"
}

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long?: string; elapsed?: number | null; extra?: number | null };
    venue?: { name?: string | null } | null;
  };
  league: { id: number; round?: string | null };
  teams: { home: { id?: number; name: string; logo?: string }; away: { id?: number; name: string; logo?: string } };
  goals: Pair;
  score?: { halftime?: Pair; fulltime?: Pair; extratime?: Pair; penalty?: Pair } | null;
  events?: ApiEvent[] | null;
}

interface ApiResponse {
  errors?: unknown;
  response?: ApiFixture[];
}

/** Correspondance des statuts API-Football -> statuts internes. */
export function mapStatus(short: string): MatchStatus {
  switch (short) {
    case "TBD":
    case "NS":
      return "scheduled";
    case "FT":
    case "AET":
    case "PEN":
      return "finished";
    case "PST":
      return "postponed";
    case "CANC":
    case "ABD":
    case "AWD":
    case "WO":
      return "cancelled";
    default:
      return "live"; // 1H, HT, 2H, ET, BT, P, SUSP, INT, LIVE
  }
}

const PERIODS = new Set<MatchPeriod>(["NS", "TBD", "1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE", "FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"]);

function pair(p: Pair): ScorePair | null {
  return p && p.home != null && p.away != null ? { home: p.home, away: p.away } : null;
}

function eventType(e: ApiEvent): MatchEventType | null {
  const t = e.type.toLowerCase();
  const d = (e.detail ?? "").toLowerCase();
  if (t === "goal") {
    if (d.includes("missed")) return "missed-penalty";
    if (d.includes("own")) return "own-goal";
    if (d.includes("penalty")) return "penalty";
    return "goal";
  }
  if (t === "card") return d.includes("red") || d.includes("second") ? "red-card" : "yellow-card";
  return null; // remplacements, VAR…
}

/**
 * Buts, penalties et cartons rouges (les jaunes et remplacements sont ignorés pour alléger).
 * Pour un but contre son camp, API-Football indique a priori l'équipe du joueur : on retient l'attribution
 * (équipe du joueur ou adversaire) qui redonne le score officiel, l'adversaire par défaut.
 */
export function mapEvents(f: ApiFixture): MatchEvent[] {
  const homeId = f.teams.home.id;
  const raw = (f.events ?? [])
    .map((e) => ({ e, type: eventType(e) }))
    .filter((x): x is { e: ApiEvent; type: MatchEventType } => x.type != null && x.type !== "yellow-card" && x.e.time?.elapsed != null)
    // tirs au but : affichés via le score de la séance, pas comme des buts du match
    .filter((x) => !(x.e.comments ?? "").toLowerCase().includes("shootout"));
  const build = (flipOwnGoals: boolean): MatchEvent[] =>
    raw.map(({ e, type }) => {
      let team: "home" | "away" = e.team.id === homeId ? "home" : "away";
      if (type === "own-goal" && flipOwnGoals) team = team === "home" ? "away" : "home";
      return {
        minute: e.time.elapsed!,
        extra: e.time.extra ?? null,
        team,
        type,
        player: e.player?.name ?? undefined,
        assist: type === "goal" ? (e.assist?.name ?? undefined) : undefined,
      };
    });
  const flipped = build(true);
  const goals = pair(f.goals);
  if (goals && raw.some((x) => x.type === "own-goal")) {
    const tally = (ev: MatchEvent[]) => {
      const s = { home: 0, away: 0 };
      for (const x of ev) if (x.type === "goal" || x.type === "penalty" || x.type === "own-goal") s[x.team]++;
      return s;
    };
    const t = tally(flipped);
    if (t.home !== goals.home || t.away !== goals.away) {
      const asIs = build(false);
      const u = tally(asIs);
      if (u.home === goals.home && u.away === goals.away) return asIs;
    }
  }
  return flipped;
}

/** Transforme un match API-Football en FixtureData (statut, score à 90 min, infos en direct). */
export function mapFixture(f: ApiFixture, competitionId: string): FixtureData {
  const short = f.fixture.status.short;
  const status = mapStatus(short);
  const ft = pair(f.score?.fulltime);
  const goals = pair(f.goals);
  // score.fulltime = score à 90 min (base du règlement) ; à défaut, le score courant
  const settleScore = ft ?? goals;
  const period: MatchPeriod = PERIODS.has(short as MatchPeriod) ? (short as MatchPeriod) : "LIVE";
  let live: LiveInfo | undefined;
  if (status === "live" || status === "finished") {
    const events = f.events ? mapEvents(f) : []; // la liste par compétition n'a pas les événements (fusion dans betting.ts)
    live = {
      period,
      elapsed: f.fixture.status.elapsed ?? null,
      extra: f.fixture.status.extra ?? null,
      goals,
      halftime: pair(f.score?.halftime),
      extratime: pair(f.score?.extratime),
      penalties: pair(f.score?.penalty),
      events,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    externalId: String(f.fixture.id),
    competitionId,
    home: f.teams.home.name,
    away: f.teams.away.name,
    homeLogo: f.teams.home.logo,
    awayLogo: f.teams.away.logo,
    kickoff: new Date(f.fixture.date).toISOString(),
    status,
    score: status === "finished" && settleScore ? settleScore : null,
    live,
    eventsIncluded: Array.isArray(f.events),
    round: f.league.round ?? undefined,
    venue: f.fixture.venue?.name ?? undefined,
  };
}

function leagueOverrides(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (process.env.API_FOOTBALL_LEAGUES ?? "").split(",")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k && Number(v) > 0) out[k] = Number(v);
  }
  return out;
}

function seasonFor(c: Competition, date: Date): number {
  const forced = Number(process.env.API_FOOTBALL_SEASON);
  if (forced > 0) return forced;
  const y = date.getUTCFullYear();
  return c.seasonMode === "split" && date.getUTCMonth() < 6 ? y - 1 : y;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const envNum = (name: string, def: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : def;
};

export function createApiFootballProvider(key: string): SportsProvider {
  const base = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";
  const quota: QuotaSnapshot = { requests: 0, remaining: null, limit: null };

  async function get(pathAndQuery: string, what: string): Promise<ApiFixture[]> {
    quota.requests++;
    const res = await fetch(`${base}${pathAndQuery}`, { headers: { "x-apisports-key": key }, cache: "no-store" });
    const rem = res.headers.get("x-ratelimit-requests-remaining");
    const lim = res.headers.get("x-ratelimit-requests-limit");
    if (rem != null && rem !== "" && Number.isFinite(Number(rem))) quota.remaining = Number(rem);
    if (lim != null && lim !== "" && Number.isFinite(Number(lim))) quota.limit = Number(lim);
    if (!res.ok) throw new Error(`API-Football ${res.status} pour ${what}`);
    const data = (await res.json()) as ApiResponse;
    const errs = data.errors && typeof data.errors === "object" ? Object.values(data.errors as Record<string, string>) : [];
    if (errs.length > 0) throw new Error(`API-Football : ${errs.join(" ; ")}`);
    return data.response ?? [];
  }

  const leagueToComp = () => {
    const overrides = leagueOverrides();
    return new Map(COMPETITIONS.map((c) => [overrides[c.id] ?? c.apiFootballId, c]));
  };

  return {
    id: "api-football",
    label: "API-Football (données réelles)",
    isDemo: false,
    syncIntervalMs: envNum("API_FOOTBALL_SYNC_MINUTES", 360) * 60 * 1000,
    liveIntervalMs: envNum("API_FOOTBALL_LIVE_SECONDS", 60) * 1000,
    async fetchFixtures(from, to) {
      const overrides = leagueOverrides();
      const results = await Promise.allSettled(
        COMPETITIONS.map(async (c) => {
          const list = await get(
            `/fixtures?league=${overrides[c.id] ?? c.apiFootballId}&season=${seasonFor(c, from)}&from=${ymd(from)}&to=${ymd(to)}&timezone=UTC`,
            c.name,
          );
          return list.map((f) => mapFixture(f, c.id));
        }),
      );
      const ok = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (ok.length === 0 && failed.length > 0) throw new Error(String(failed[0].reason?.message ?? failed[0].reason));
      return ok;
    },
    async fetchLive(externalIds) {
      const byLeague = leagueToComp();
      const ids = [...new Set(externalIds)].filter((x) => /^\d+$/.test(x));
      const out: FixtureData[] = [];
      for (let i = 0; i < ids.length; i += 20) {
        const list = await get(`/fixtures?ids=${ids.slice(i, i + 20).join("-")}&timezone=UTC`, "le direct");
        for (const f of list) {
          const c = byLeague.get(f.league.id);
          if (c) out.push(mapFixture(f, c.id));
        }
      }
      return out;
    },
    takeQuota() {
      const snap = { ...quota };
      quota.requests = 0;
      return snap;
    },
  };
}
