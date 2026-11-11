// Paramètres économiques de la plateforme. Modifiez-les ici.
// Les montants sont exprimés en unités "humaines" (1 = 1 Cori ou 1 Lion).

export const SIGNUP_BONUS_CORIS = 500; // Coris offerts à l'inscription
export const STAKE_CORIS = 50; // mise pour une partie en Coris (niveau normal)
export const STAKE_CORIS_RUN = 20; // mise Endless Run et Course auto, en Coris
export const CORIS_PER_LION = 50; // taux de conversion : 50 Coris = 1 Lion
// Mise d'une partie Pro en Lions (configurable par variable d'environnement PRO_STAKE_LIONS)
export const PRO_STAKE_LIONS = Number(process.env.PRO_STAKE_LIONS ?? 1) || 1;
export const WINNER_SHARE = 0.8; // 80 % du pot pour le gagnant
export const HOUSE_SHARE = 0.2; // 20 % pour la maison
// Délai (ms) après lequel on peut réclamer la victoire si l'adversaire ne joue plus
export const INACTIVITY_CLAIM_MS = 2 * 60 * 1000;

// Stockage interne : tous les montants sont des entiers en centièmes (x100)
export const UNIT = 100;
export const toUnits = (v: number) => Math.round(v * UNIT);
export const fromUnits = (u: number) => u / UNIT;

// ---------------------------------------------------------------------------
// F CFA (XOF), paiements Mobile Money et paris sportifs
// Les montants F CFA sont des francs entiers (stockés eux aussi en centièmes en interne).
// ---------------------------------------------------------------------------
const envInt = (name: string, def: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : def;
};

/** HYPOTHÈSE à fixer par le propriétaire : valeur d'1 Lion en F CFA (variable d'env. FCFA_PER_LION). */
export const FCFA_PER_LION = envInt("FCFA_PER_LION", 500);
/** Dépôt Mobile Money : minimum / maximum par opération (F CFA). */
export const DEPOSIT_MIN_FCFA = envInt("DEPOSIT_MIN_FCFA", 200);
export const DEPOSIT_MAX_FCFA = envInt("DEPOSIT_MAX_FCFA", 500000);
/** Retrait Mobile Money : minimum / maximum par demande (F CFA). */
export const WITHDRAW_MIN_FCFA = envInt("WITHDRAW_MIN_FCFA", 500);
export const WITHDRAW_MAX_FCFA = envInt("WITHDRAW_MAX_FCFA", 500000);
function envFloat(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 && v < 1 ? v : def;
}

/** Paris sportifs : mise minimum / maximum par pari (F CFA). */
export const BET_MIN_FCFA = envInt("BET_MIN_FCFA", 100);
export const BET_MAX_FCFA = envInt("BET_MAX_FCFA", 100000);
/** Paris sportifs (pari mutuel) : part du pot reversée aux gagnants / gardée par la maison. */
export const BET_WINNERS_SHARE = envFloat("BET_WINNERS_SHARE", 0.9); // 90 % aux gagnants
export const BET_HOUSE_SHARE = Math.round((1 - BET_WINNERS_SHARE) * 1000) / 1000; // 10 % pour la maison
/**
 * Cotes affichées : mélange entre la cote de référence (bookmakers ou FarimaGame) et la cote du pot.
 * Poids du pot = pot ÷ (pot + BET_ODDS_BLEND_K). Avec 20 000 F : pot de 20 000 F -> moitié / moitié.
 */
export const BET_ODDS_BLEND_K = envInt("BET_ODDS_BLEND_K", 20000);
/** Paiements : "simulation" (seul fournisseur disponible pour l'instant). */
export const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER ?? "simulation";
