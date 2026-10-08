// The Odds API (https://the-odds-api.com, v4) : vraies cotes de bookmakers.
// Ce fichier ne contient que la partie « pure » (URL, lecture de la réponse, rapprochement des matchs) ;
// le cache et la planification des appels sont dans lib/server/odds.ts.
//
// Requête : GET /v4/sports/{sport_key}/odds?regions=eu&markets=h2h,totals&oddsFormat=decimal&apiKey=…
// Coût d'un appel (quota) = nombre de marchés × nombre de régions = 2 crédits.
import { fitGoals } from "./model";
import { NATIONAL_COMPS, sameTeam } from "./teams";

/**
 * Compétition FarimaGame -> clé de sport The Odds API (liste publique : https://the-odds-api.com/sports-odds-data/sports-apis.html).
 * Non couvertes par The Odds API (cotes FarimaGame calculées) : Ligue des champions CAF, Ligue 1 ivoirienne,
 * éliminatoires CdM Afrique, éliminatoires CAN. Si une clé apparaît plus tard, ajoutez-la sans toucher au code :
 *   ODDS_API_SPORTS="wcq-afr=soccer_fifa_world_cup_qualifiers_africa,cafcl=…"
 */
export const ODDS_API_SPORTS: Record<string, string> = {
  epl: "soccer_epl",
  laliga: "soccer_spain_la_liga",
  seriea: "soccer_italy_serie_a",
  bundesliga: "soccer_germany_bundesliga",
  ligue1: "soccer_france_ligue_one",
  ucl: "soccer_uefa_champs_league",
  can: "soccer_africa_cup_of_nations",
  "wcq-eur": "soccer_fifa_world_cup_qualifiers_europe",
};

export function sportKeys(): Record<string, string> {
  const out = { ...ODDS_API_SPORTS };
  for (const part of (process.env.ODDS_API_SPORTS ?? "").split(",")) {
    const [k, v] = part.split("=").map((x) => x.trim());
    if (k && v) out[k] = v;
    else if (k && part.includes("=") && !v) delete out[k]; // "cafcl=" désactive une compétition
  }
  return out;
}

export const ODDS_API_MARKETS = "h2h,totals";

export function oddsApiUrl(base: string, sport: string, key: string): string {
  const q = new URLSearchParams({ apiKey: key, regions: process.env.ODDS_API_REGIONS ?? "eu", markets: ODDS_API_MARKETS, oddsFormat: "decimal", dateFormat: "iso" });
  return `${base.replace(/\/$/, "")}/v4/sports/${encodeURIComponent(sport)}/odds?${q}`;
}

// ------------------------------------------------------------------ format de la réponse
interface ApiOutcome {
  name: string;
  price: number;
  point?: number;
}
interface ApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: { key: string; title?: string; markets?: { key: string; outcomes?: ApiOutcome[] }[] }[];
}

/** Un match vu par les bookmakers, résumé (c'est ce qui est gardé en cache dans data/db.json). */
export interface OddsEvent {
  id: string;
  sport: string;
  commence: string;
  home: string;
  away: string;
  /** Nombre de bookmakers pris en compte. */
  books: number;
  /** Cotes médianes des bookmakers (avec leur marge). */
  median: { "1": number; N: number; "2": number; plus?: number; moins?: number };
  /** Probabilités « justes » : 1 / cote médiane, renormalisées pour retirer la marge des bookmakers. */
  fair: { "1": number; N: number; "2": number; plus?: number; moins?: number };
  /** Buts attendus déduits des probabilités (sert au marché « les deux équipes marquent »). */
  lh: number;
  la: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

/** Résume la réponse JSON de /v4/sports/{sport}/odds (événements sans cote 1N2 complète ignorés). */
export function parseOddsResponse(data: unknown, sport: string): OddsEvent[] {
  if (!Array.isArray(data)) return [];
  const out: OddsEvent[] = [];
  for (const ev of data as ApiEvent[]) {
    if (!ev || typeof ev.home_team !== "string" || typeof ev.away_team !== "string" || !ev.commence_time) continue;
    const h: number[] = [], d: number[] = [], a: number[] = [], ov: number[] = [], un: number[] = [];
    let books = 0;
    for (const b of ev.bookmakers ?? []) {
      const h2h = b.markets?.find((m) => m.key === "h2h")?.outcomes ?? [];
      const ph = h2h.find((o) => o.name === ev.home_team)?.price;
      const pa = h2h.find((o) => o.name === ev.away_team)?.price;
      const pd = h2h.find((o) => o.name === "Draw")?.price;
      if (ph && pa && pd && ph > 1 && pa > 1 && pd > 1) {
        h.push(ph);
        a.push(pa);
        d.push(pd);
        books++;
      }
      const tot = (b.markets?.find((m) => m.key === "totals")?.outcomes ?? []).filter((o) => o.point === 2.5);
      const po = tot.find((o) => o.name === "Over")?.price;
      const pu = tot.find((o) => o.name === "Under")?.price;
      if (po && pu && po > 1 && pu > 1) {
        ov.push(po);
        un.push(pu);
      }
    }
    if (books === 0) continue;
    const m1 = median(h), mN = median(d), m2 = median(a);
    const inv = 1 / m1 + 1 / mN + 1 / m2;
    const fair: OddsEvent["fair"] = { "1": r4(1 / m1 / inv), N: r4(1 / mN / inv), "2": r4(1 / m2 / inv) };
    const med: OddsEvent["median"] = { "1": m1, N: mN, "2": m2 };
    if (ov.length > 0) {
      const mo = median(ov), mu = median(un);
      const invT = 1 / mo + 1 / mu;
      med.plus = mo;
      med.moins = mu;
      fair.plus = r4(1 / mo / invT);
      fair.moins = r4(1 - fair.plus);
    }
    const { lh, la } = fitGoals({ "1": fair["1"], N: fair.N, "2": fair["2"] }, fair.plus);
    out.push({ id: ev.id, sport, commence: new Date(ev.commence_time).toISOString(), home: ev.home_team, away: ev.away_team, books, median: med, fair, lh, la });
  }
  return out;
}

/** Écart maximal accepté entre l'heure du match chez nous et chez les bookmakers. */
const MATCH_WINDOW_MS = 6 * 3600 * 1000;

/** Rapproche un de nos matchs d'un événement The Odds API (même compétition, mêmes équipes, heure proche). */
export function findEventFor(
  events: OddsEvent[],
  m: { competitionId: string; home: string; away: string; kickoff: string },
  sports = sportKeys(),
): OddsEvent | null {
  const sport = sports[m.competitionId];
  if (!sport) return null;
  const national = NATIONAL_COMPS.has(m.competitionId);
  const t = Date.parse(m.kickoff);
  let best: OddsEvent | null = null;
  let bestGap = Infinity;
  for (const e of events) {
    if (e.sport !== sport) continue;
    const gap = Math.abs(Date.parse(e.commence) - t);
    if (gap > MATCH_WINDOW_MS || gap >= bestGap) continue;
    if (sameTeam(e.home, m.home, national) && sameTeam(e.away, m.away, national)) {
      best = e;
      bestGap = gap;
    }
  }
  return best;
}
