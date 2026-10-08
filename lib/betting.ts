// Règles des paris sportifs (partagées client / serveur, sans accès à la base).
import type { MarketId, MatchStatus, Selection } from "./types";

export interface MarketDef {
  id: MarketId;
  label: string;
  short: string;
  outcomes: { selection: Selection; label: string; short: string }[];
}

export const MARKETS: MarketDef[] = [
  {
    id: "1N2",
    label: "3 Way · Résultat du match (1 N 2)",
    short: "1N2",
    outcomes: [
      { selection: "1", label: "Victoire domicile", short: "1" },
      { selection: "N", label: "Match nul", short: "N" },
      { selection: "2", label: "Victoire extérieur", short: "2" },
    ],
  },
  {
    id: "BTTS",
    label: "Les deux équipes marquent",
    short: "2 marquent",
    outcomes: [
      { selection: "oui", label: "Oui", short: "Oui" },
      { selection: "non", label: "Non", short: "Non" },
    ],
  },
  {
    id: "OU25",
    label: "Plus / Moins de 2,5 buts",
    short: "+/- 2,5",
    outcomes: [
      { selection: "plus", label: "Plus de 2,5 buts", short: "+2,5" },
      { selection: "moins", label: "Moins de 2,5 buts", short: "-2,5" },
    ],
  },
];

export const MARKET_BY_ID = Object.fromEntries(MARKETS.map((m) => [m.id, m])) as Record<MarketId, MarketDef>;

export function selectionLabel(market: MarketId, sel: Selection, home?: string, away?: string): string {
  if (market === "1N2" && home && away) return sel === "1" ? home : sel === "2" ? away : "Match nul";
  return MARKET_BY_ID[market]?.outcomes.find((o) => o.selection === sel)?.label ?? sel;
}

/** Issue gagnante d'un marché selon le score final (temps réglementaire). */
export function winningSelection(market: MarketId, score: { home: number; away: number }): Selection {
  const { home, away } = score;
  switch (market) {
    case "1N2":
      return home > away ? "1" : home < away ? "2" : "N";
    case "BTTS":
      return home > 0 && away > 0 ? "oui" : "non";
    case "OU25":
      return home + away > 2.5 ? "plus" : "moins";
  }
}

/**
 * Cote estimée d'une issue en pari mutuel : (pot total × part des gagnants) ÷ mises sur l'issue.
 * `extra` = mise que le joueur envisage d'ajouter (elle grossit le pot ET l'issue).
 */
export function estimatedOdds(poolTotal: number, outcomeTotal: number, winnersShare: number, extra = 0): number | null {
  const o = outcomeTotal + extra;
  if (o <= 0) return null;
  return ((poolTotal + extra) * winnersShare) / o;
}

export const MIN_ODDS = 1.01;
export const MAX_ODDS = 250;

/** Cote décimale à partir d'une probabilité, marge de la maison incluse : part des gagnants ÷ p (arrondie au centième). */
export function oddsFromProb(p: number, winnersShare: number): number {
  if (!(p > 0)) return MAX_ODDS;
  return Math.min(MAX_ODDS, Math.max(MIN_ODDS, Math.round((winnersShare / p) * 100) / 100));
}

/** Poids du pot dans la cote affichée : w = pot ÷ (pot + K). 0 sans mise, tend vers 1 quand le pot grossit. */
export function blendWeight(poolTotal: number, k: number): number {
  return poolTotal > 0 ? poolTotal / (poolTotal + Math.max(1, k)) : 0;
}

/**
 * Cote affichée d'une issue (toujours un nombre) :
 *   p = (1 − w) × p_référence + w × (mises sur l'issue ÷ pot),  cote = part des gagnants ÷ p.
 * p_référence = probabilité sans marge (bookmakers ou modèle FarimaGame) ; w = blendWeight(pot, K).
 * `extra` = mise que le joueur envisage d'ajouter (elle grossit le pot ET l'issue) -> cote estimée de son ticket.
 * Rappel : c'est une ESTIMATION ; en pari mutuel, le gain réel est fixé par le pot final.
 */
export function blendedOdds(refProb: number, poolTotal: number, outcomeTotal: number, winnersShare: number, k: number, extra = 0): number {
  const pot = poolTotal + extra;
  const w = blendWeight(pot, k);
  const p = (1 - w) * refProb + (pot > 0 ? (w * (outcomeTotal + extra)) / pot : 0);
  return oddsFromProb(p, winnersShare);
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "À venir",
  live: "En cours",
  finished: "Terminé",
  postponed: "Reporté",
  cancelled: "Annulé",
};

export function fmtOdds(o: number | null): string {
  if (o == null) return "—";
  return "×" + o.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtFcfa(n: number): string {
  return `${Math.floor(n).toLocaleString("fr-FR")} F CFA`;
}
