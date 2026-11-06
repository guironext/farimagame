// Awalé (variante Abapa, la plus jouée en Côte d'Ivoire)
// - 2 x 6 trous, 4 graines par trou (48 graines).
// - Le joueur 0 possède les trous 0..5 (rangée du bas, de gauche à droite),
//   le joueur 1 les trous 6..11 (rangée du haut, de droite à gauche). Semis dans le sens 0 -> 11.
// - Avec 12 graines ou plus, on saute le trou de départ.
// - Capture : si la dernière graine tombe chez l'adversaire et porte le trou à 2 ou 3,
//   on capture, puis on remonte les trous précédents (côté adversaire) tant qu'ils ont 2 ou 3.
// - Grand chelem : un coup qui capturerait toutes les graines adverses est joué mais ne capture rien.
// - Il faut nourrir l'adversaire s'il n'a plus de graines ; si c'est impossible, la partie s'arrête
//   et le joueur ramasse les graines de son camp.
// - Le premier à plus de 24 graines gagne ; 24-24 = match nul.
// - Anti-boucle : après 300 coups, chacun ramasse les graines de son camp et on compare.
import { Engine, GameError, GameResult } from "./engine";

export interface AwaleState {
  pits: number[];
  store: [number, number];
  turn: 0 | 1;
  moves: number;
  over: boolean;
  winner: number | null;
  draw: boolean;
  last?: { seat: number; pit: number; captured: number[] };
}

export const AWALE_MAX_MOVES = 300;

const own = (seat: number, i: number) => (seat === 0 ? i >= 0 && i <= 5 : i >= 6 && i <= 11);
const sideSum = (pits: number[], seat: number) => {
  let t = 0;
  for (let i = seat * 6; i < seat * 6 + 6; i++) t += pits[i];
  return t;
};

/** Trous qui reçoivent une graine, dans l'ordre du semis. Le trou de départ est sauté. */
export function sowPath(pits: number[], pit: number): number[] {
  const path: number[] = [];
  let seeds = pits[pit] ?? 0;
  let i = pit;
  while (seeds > 0) {
    i = (i + 1) % 12;
    if (i === pit) continue;
    path.push(i);
    seeds--;
  }
  return path;
}

export function simulate(pits: number[], seat: number, pit: number) {
  const p = pits.slice();
  const path = sowPath(p, pit);
  p[pit] = 0;
  for (const i of path) p[i]++;
  const opp = 1 - seat;
  const caps: number[] = [];
  let j = path.length > 0 ? path[path.length - 1] : pit;
  while (own(opp, j) && (p[j] === 2 || p[j] === 3)) {
    caps.push(j);
    j--;
  }
  let captured = 0;
  const afterSow = p.slice();
  if (caps.length) {
    for (const c of caps) captured += p[c];
    for (const c of caps) p[c] = 0;
    if (sideSum(p, opp) === 0) {
      // grand chelem : aucune capture
      return { pits: afterSow, captured: 0, caps: [] as number[] };
    }
  }
  return { pits: p, captured, caps };
}

export function legalMoves(s: AwaleState, seat: number): number[] {
  if (s.over) return [];
  const res: number[] = [];
  const opp = 1 - seat;
  const oppEmpty = sideSum(s.pits, opp) === 0;
  for (let i = seat * 6; i < seat * 6 + 6; i++) {
    if (s.pits[i] === 0) continue;
    if (oppEmpty) {
      const sim = simulate(s.pits, seat, i);
      if (sideSum(sim.pits, opp) === 0) continue;
    }
    res.push(i);
  }
  return res;
}

function finish(s: AwaleState) {
  s.over = true;
  if (s.store[0] > s.store[1]) s.winner = 0;
  else if (s.store[1] > s.store[0]) s.winner = 1;
  else {
    s.winner = null;
    s.draw = true;
  }
}

function sweep(s: AwaleState) {
  for (const seat of [0, 1] as const) {
    s.store[seat] += sideSum(s.pits, seat);
    for (let i = seat * 6; i < seat * 6 + 6; i++) s.pits[i] = 0;
  }
}

function checkEnd(s: AwaleState) {
  if (s.store[0] > 24 || s.store[1] > 24) return finish(s);
  if (s.moves >= AWALE_MAX_MOVES) {
    sweep(s);
    return finish(s);
  }
  const moves = legalMoves(s, s.turn);
  if (moves.length === 0) {
    // impossible de jouer (ou de nourrir l'adversaire) : chacun ramasse son camp
    sweep(s);
    finish(s);
  }
}

function applyRaw(s: AwaleState, seat: number, pit: number): AwaleState {
  const sim = simulate(s.pits, seat, pit);
  const n: AwaleState = {
    ...s,
    pits: sim.pits,
    store: [s.store[0], s.store[1]],
    turn: (1 - seat) as 0 | 1,
    moves: s.moves + 1,
    last: { seat, pit, captured: sim.caps },
  };
  n.store[seat] += sim.captured;
  checkEnd(n);
  return n;
}

function negamax(s: AwaleState, seat: number, depth: number, alpha: number, beta: number): number {
  if (s.over) {
    if (s.draw) return 0;
    return s.winner === seat ? 1000 + depth : -1000 - depth;
  }
  if (depth === 0) return s.store[seat] - s.store[1 - seat];
  const moves = legalMoves(s, s.turn);
  let best = -Infinity;
  for (const m of moves) {
    const n = applyRaw(s, s.turn, m);
    const v = n.turn === seat || n.over ? negamax(n, seat, depth - 1, alpha, beta) : -negamax(n, 1 - seat, depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export const awale: Engine<AwaleState, { pit: number }> = {
  init() {
    return { pits: Array(12).fill(4), store: [0, 0], turn: 0, moves: 0, over: false, winner: null, draw: false };
  },
  current(s) {
    return s.over ? null : s.turn;
  },
  apply(s, seat, move, names) {
    if (s.over) throw new GameError("La partie est terminée.");
    if (s.turn !== seat) throw new GameError("Ce n'est pas votre tour.");
    const pit = Number(move?.pit);
    if (!legalMoves(s, seat).includes(pit)) throw new GameError("Coup illégal.");
    const n = applyRaw(s, seat, pit);
    const log = [`${names[seat]} sème le trou ${(pit % 6) + 1}`];
    const got = n.store[seat] - s.store[seat];
    if (got > 0 && !n.over) log.push(`${names[seat]} capture ${got} graine(s)`);
    if (n.over) log.push(`Fin de partie : ${n.store[0]} - ${n.store[1]}`);
    return { state: n, log };
  },
  result(s): GameResult {
    return { over: s.over, winner: s.winner, draw: s.draw };
  },
  ai(s, seat) {
    const moves = legalMoves(s, seat);
    let best = moves[0];
    let bestV = -Infinity;
    for (const m of moves) {
      const n = applyRaw(s, seat, m);
      const v = n.over
        ? n.draw ? 0 : n.winner === seat ? 10000 : -10000
        : -negamax(n, 1 - seat, 5, -Infinity, Infinity);
      if (v > bestV || (v === bestV && Math.random() < 0.3)) {
        bestV = v;
        best = m;
      }
    }
    return { pit: best };
  },
  resign(s) {
    return s;
  },
};
