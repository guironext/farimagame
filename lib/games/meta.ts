import { STAKE_CORIS } from "../config";
import type { GameId, Mode } from "../types";

export interface GameMeta {
  id: GameId;
  name: string;
  short: string;
  emoji: string;
  modes: Mode[];
  description: string;
  color: string; // classes tailwind de dégradé
  stakeCoris: number;
}

export const GAMES: Record<GameId, GameMeta> = {
  ludo: {
    id: "ludo",
    name: "Ludo",
    short: "Ludo",
    emoji: "🎲",
    modes: ["cpu", "2", "3", "4"],
    description:
      "Lancez le dé, sortez vos pions avec un 6 et ramenez les 4 à la maison avant vos adversaires.",
    color: "from-rose-500 to-orange-400",
    stakeCoris: STAKE_CORIS,
  },
  dames: {
    id: "dames",
    name: "Jeu de Dames",
    short: "Dames",
    emoji: "⛀",
    modes: ["cpu", "2"],
    description:
      "Dames internationales 10×10 : prise obligatoire et majoritaire, dames volantes.",
    color: "from-amber-600 to-yellow-400",
    stakeCoris: STAKE_CORIS,
  },
  awale: {
    id: "awale",
    name: "Awalé",
    short: "Awalé",
    emoji: "🌰",
    modes: ["cpu", "2"],
    description:
      "Semez les graines, capturez par 2 ou 3 chez l'adversaire. Le premier à 25 graines gagne.",
    color: "from-emerald-600 to-lime-400",
    stakeCoris: STAKE_CORIS,
  },
  echecs: {
    id: "echecs",
    name: "Échecs",
    short: "Échecs",
    emoji: "♞",
    modes: ["cpu", "2"],
    description:
      "Le roi des jeux de stratégie : mettez le roi adverse échec et mat.",
    color: "from-sky-600 to-indigo-500",
    stakeCoris: STAKE_CORIS,
  },
};

export const GAME_LIST = Object.values(GAMES);

export function modeLabel(m: Mode): string {
  return m === "cpu" ? "Contre l'ordinateur" : `${m} joueurs`;
}

export function modePlayers(m: Mode): number {
  return m === "cpu" ? 2 : Number(m);
}
