import { COLOR_START, HOME, SAFE_GLOBALS } from "@/lib/games/ludo";

export type RC = [number, number];

/** Parcours de 52 cases, même tracé que le plateau historique (départ rouge en haut à gauche). */
export const TRACK: RC[] = (() => {
  const t: RC[] = [];
  for (let c = 1; c <= 5; c++) t.push([6, c]);
  for (let r = 5; r >= 0; r--) t.push([r, 6]);
  t.push([0, 7]);
  for (let r = 0; r <= 5; r++) t.push([r, 8]);
  for (let c = 9; c <= 14; c++) t.push([6, c]);
  t.push([7, 14]);
  for (let c = 14; c >= 9; c--) t.push([8, c]);
  for (let r = 9; r <= 14; r++) t.push([r, 8]);
  t.push([14, 7]);
  for (let r = 14; r >= 9; r--) t.push([r, 6]);
  for (let c = 5; c >= 0; c--) t.push([8, c]);
  t.push([7, 0]);
  t.push([6, 0]);
  return t;
})();

export const HOME_COL: RC[][] = [
  [1, 2, 3, 4, 5].map((c) => [7, c] as RC),
  [1, 2, 3, 4, 5].map((r) => [r, 7] as RC),
  [13, 12, 11, 10, 9].map((c) => [7, c] as RC),
  [13, 12, 11, 10, 9].map((r) => [r, 7] as RC),
];

export const FINISH: RC[] = [
  [7, 6],
  [6, 7],
  [7, 8],
  [8, 7],
];

export const BASE_ORIGIN: RC[] = [
  [0, 0],
  [0, 9],
  [9, 9],
  [9, 0],
];

const BASE_SPOTS: RC[] = [
  [1, 1],
  [1, 4],
  [4, 1],
  [4, 4],
];

/** Rouge, vert, jaune, bleu — mêmes index que LUDO_COLORS. */
export const YARD_HEX = [0xe11d48, 0x16a34a, 0xeab308, 0x2563eb] as const;

export const SAFE_KEYS = new Set(SAFE_GLOBALS.map((g) => TRACK[g].join(",")));

export function posToRC(color: number, pos: number, token: number): RC {
  if (pos === -1) {
    const o = BASE_ORIGIN[color];
    const s = BASE_SPOTS[token];
    return [o[0] + s[0], o[1] + s[1]];
  }
  if (pos === HOME) return FINISH[color];
  if (pos > 50) return HOME_COL[color][pos - 51];
  return TRACK[(COLOR_START[color] + pos) % 52];
}

/** Centre de la case sur le plan du plateau (x, z). L'origine est le milieu du plateau. */
export function cellXZ(r: number, c: number): [number, number] {
  return [c - 7, r - 7];
}
