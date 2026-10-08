// Modèle de cotes FarimaGame (sans API) : niveau des équipes -> buts attendus -> probabilités -> cotes.
//
// 1. Écart de niveau : d = note(domicile) + avantage du terrain − note(extérieur) + forme du jour
//    (la « forme » est un petit décalage de ±20 points, déterministe par match).
// 2. Buts attendus (loi de Poisson) : avec T = moyenne de buts de la compétition et s = 0,0035 × d
//    (≈ 1 but d'écart pour 285 points),  λdom = (T + s) / 2,  λext = (T − s) / 2  (minimum 0,15).
// 3. Grille des scores 0-0 … 10-10 : P(i, j) = Poisson(i; λdom) × Poisson(j; λext), corrigée façon
//    Dixon-Coles (ρ = −0,10 : un peu plus de 0-0 et de 1-1, comme dans la réalité), puis renormalisée.
// 4. On lit toutes les issues sur la même grille : 1 / N / 2, les deux équipes marquent, plus/moins de 2,5 buts.
// 5. Cote = part des gagnants ÷ probabilité (0,9 / p), arrondie au centième, entre 1,01 et 250
//    (voir oddsFromProb dans lib/betting.ts). La somme des 1/cote d'un marché vaut donc ≈ 1/0,9 ≈ 1,111.
import type { MarketId, Selection } from "../types";
import { NATIONAL_COMPS, teamRating } from "./teams";

const HOME_ADV: Record<string, number> = {
  epl: 65, laliga: 70, seriea: 65, bundesliga: 65, ligue1: 65, ucl: 70,
  can: 25, cafcl: 95, "ci-ligue1": 55, "wcq-afr": 95, "wcq-eur": 80, canq: 95,
};
const AVG_GOALS: Record<string, number> = {
  epl: 2.85, laliga: 2.6, seriea: 2.65, bundesliga: 3.1, ligue1: 2.75, ucl: 3.0,
  can: 2.2, cafcl: 2.1, "ci-ligue1": 2.05, "wcq-afr": 2.25, "wcq-eur": 2.6, canq: 2.3,
};
const GOALS_PER_POINT = 0.0035;
const RHO = -0.1;
const MAX_GOALS = 10;

/** Probabilités « justes » (sans marge) de chaque issue, par marché. */
export type MarketProbs = Record<MarketId, Partial<Record<Selection, number>>>;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

function poissonRow(lambda: number): number[] {
  const out = [Math.exp(-lambda)];
  for (let k = 1; k <= MAX_GOALS; k++) out.push((out[k - 1] * lambda) / k);
  return out;
}

/** Probabilités de tous les marchés à partir des buts attendus de chaque équipe. */
export function probsFromGoals(lh: number, la: number): MarketProbs {
  const ph = poissonRow(lh);
  const pa = poissonRow(la);
  let home = 0, draw = 0, away = 0, btts = 0, over = 0, total = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      let p = ph[i] * pa[j];
      if (i === 0 && j === 0) p *= 1 - lh * la * RHO;
      else if (i === 0 && j === 1) p *= 1 + lh * RHO;
      else if (i === 1 && j === 0) p *= 1 + la * RHO;
      else if (i === 1 && j === 1) p *= 1 - RHO;
      p = Math.max(p, 0);
      total += p;
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
      if (i > 0 && j > 0) btts += p;
      if (i + j > 2.5) over += p;
    }
  }
  return {
    "1N2": { "1": home / total, N: draw / total, "2": away / total },
    BTTS: { oui: btts / total, non: 1 - btts / total },
    OU25: { plus: over / total, moins: 1 - over / total },
  };
}

export interface ModelResult {
  lh: number;
  la: number;
  homeRating: number;
  awayRating: number;
  /** true si les deux équipes sont dans la base (sinon note par défaut de la compétition). */
  known: boolean;
  probs: MarketProbs;
}

/** Cotes de départ FarimaGame d'un match (déterministes : même match -> mêmes cotes). */
export function modelForMatch(m: { id: string; competitionId: string; home: string; away: string }): ModelResult {
  const h = teamRating(m.home, m.competitionId);
  const a = teamRating(m.away, m.competitionId);
  const form = (hash(`${m.id}|form`) - 0.5) * 40; // ±20 points
  const d = h.rating + (HOME_ADV[m.competitionId] ?? (NATIONAL_COMPS.has(m.competitionId) ? 80 : 65)) - a.rating + form;
  const T = AVG_GOALS[m.competitionId] ?? 2.6;
  const s = d * GOALS_PER_POINT;
  const lh = Math.max(0.15, (T + s) / 2);
  const la = Math.max(0.15, (T - s) / 2);
  return { lh, la, homeRating: h.rating, awayRating: a.rating, known: h.known && a.known, probs: probsFromGoals(lh, la) };
}

/**
 * Trouve les buts attendus (λdom, λext) qui reproduisent au mieux des probabilités 1/N/2 (et, si connue,
 * la probabilité de « plus de 2,5 buts ») : sert à déduire le marché « les deux équipes marquent »
 * des cotes bookmakers, qui ne le fournissent pas dans l'offre de base.
 */
export function fitGoals(p1n2: { "1": number; N: number; "2": number }, pOver?: number): { lh: number; la: number } {
  let best = { lh: 1.4, la: 1.1, err: Infinity };
  const evalAt = (lh: number, la: number) => {
    const p = probsFromGoals(lh, la);
    let err = (p["1N2"]["1"]! - p1n2["1"]) ** 2 + (p["1N2"].N! - p1n2.N) ** 2 + (p["1N2"]["2"]! - p1n2["2"]) ** 2;
    if (pOver != null) err += (p.OU25.plus! - pOver) ** 2;
    if (err < best.err) best = { lh, la, err };
  };
  for (let lh = 0.2; lh <= 4.01; lh += 0.1) for (let la = 0.2; la <= 4.01; la += 0.1) evalAt(lh, la);
  const { lh: h0, la: a0 } = best;
  for (let lh = h0 - 0.1; lh <= h0 + 0.1001; lh += 0.01) for (let la = a0 - 0.1; la <= a0 + 0.1001; la += 0.01) if (lh > 0.05 && la > 0.05) evalAt(lh, la);
  return { lh: Math.round(best.lh * 100) / 100, la: Math.round(best.la * 100) / 100 };
}
