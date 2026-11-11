// Jeu de dames international (10x10)
// - Les blancs (joueur 0, en bas) commencent. Les noirs (joueur 1) sont en haut.
// - Les pions avancent d'une case en diagonale ; ils prennent en avant ET en arrière.
// - La prise est obligatoire et il faut prendre le maximum de pièces (règle de la majorité).
// - Les pièces prises ne sont retirées qu'à la fin de la rafle et ne peuvent être sautées deux fois.
// - Les dames sont volantes (déplacement et prise à distance).
// - Un pion qui termine son coup sur la dernière rangée devient dame (pas s'il ne fait qu'y passer).
// - Un joueur qui ne peut plus jouer a perdu. Nul après 50 coups consécutifs de dames sans prise.
import { Engine, GameError, GameResult } from "./engine";

export interface DamesMove {
  from: number;
  path: number[]; // cases d'arrivée successives
  captures: number[];
}

export interface DamesState {
  board: number[]; // 1 pion blanc, 2 dame blanche, -1 pion noir, -2 dame noire, 0 vide
  turn: 0 | 1;
  quiet: number; // coups consécutifs de dames sans prise
  moves: number;
  over: boolean;
  winner: number | null;
  draw: boolean;
  last?: DamesMove;
}

export const DAMES_DRAW_QUIET = 50;
const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const sideOf = (p: number) => (p > 0 ? 0 : p < 0 ? 1 : -1);
const inside = (r: number, c: number) => r >= 0 && r < 10 && c >= 0 && c < 10;

export function initialBoard(): number[] {
  const b = Array(100).fill(0);
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++) {
      if ((r + c) % 2 === 1) {
        if (r <= 3) b[r * 10 + c] = -1;
        else if (r >= 6) b[r * 10 + c] = 1;
      }
    }
  return b;
}

// Une rafle de dames volantes peut compter des millions de trajets. On explore
// palier par palier et on s'arrête avant de bloquer le serveur : la partie reste jouable.
const CAPTURE_BUDGET = 8000;
const FRONTIER_CAP = 2000;

function captureSteps(board: number[], pos: number, seat: number, king: boolean, caps: number[]) {
  const r0 = Math.floor(pos / 10);
  const c0 = pos % 10;
  const steps: { land: number; mid: number }[] = [];
  for (const [dr, dc] of DIRS) {
    if (!king) {
      const mr = r0 + dr, mc = c0 + dc, lr = r0 + 2 * dr, lc = c0 + 2 * dc;
      if (!inside(lr, lc)) continue;
      const mid = mr * 10 + mc, land = lr * 10 + lc;
      if (board[mid] !== 0 && sideOf(board[mid]) !== seat && !caps.includes(mid) && board[land] === 0) steps.push({ land, mid });
    } else {
      let r = r0 + dr, c = c0 + dc;
      while (inside(r, c) && board[r * 10 + c] === 0) {
        r += dr;
        c += dc;
      }
      if (!inside(r, c)) continue;
      const mid = r * 10 + c;
      if (board[mid] === 0 || sideOf(board[mid]) === seat || caps.includes(mid)) continue;
      let lr = r + dr, lc = c + dc;
      while (inside(lr, lc) && board[lr * 10 + lc] === 0) {
        steps.push({ land: lr * 10 + lc, mid });
        lr += dr;
        lc += dc;
      }
    }
  }
  return steps;
}

function keepPartial(from: number, nodes: { path: number[]; caps: number[] }[], into: DamesMove[]) {
  for (const fr of nodes) if (fr.caps.length) into.push({ from, path: fr.path, captures: fr.caps });
}

function capturesFrom(board: number[], from: number, budget: { nodes: number }, stopAt = Infinity): DamesMove[] {
  const piece = board[from];
  const seat = sideOf(piece);
  const king = Math.abs(piece) === 2;
  const b = board.slice();
  b[from] = 0;
  let frontier = [{ pos: from, path: [] as number[], caps: [] as number[] }];
  const done: DamesMove[] = [];
  for (let jumps = 0; jumps < 20 && frontier.length; jumps++) {
    const next: typeof frontier = [];
    for (const fr of frontier) {
      if (budget.nodes++ > CAPTURE_BUDGET) {
        keepPartial(from, frontier, done);
        return done;
      }
      const steps = captureSteps(b, fr.pos, seat, king, fr.caps);
      if (!steps.length) {
        if (fr.caps.length) done.push({ from, path: fr.path, captures: fr.caps });
        if (done.length >= stopAt) return done;
        continue;
      }
      for (const step of steps) {
        next.push({ pos: step.land, path: [...fr.path, step.land], caps: [...fr.caps, step.mid] });
        if (next.length >= FRONTIER_CAP) break;
      }
      if (next.length >= FRONTIER_CAP) break;
    }
    frontier = next;
  }
  keepPartial(from, frontier, done);
  return done;
}

function simpleMoves(board: number[], from: number): DamesMove[] {
  const piece = board[from];
  const seat = sideOf(piece);
  const king = Math.abs(piece) === 2;
  const r0 = Math.floor(from / 10), c0 = from % 10;
  const res: DamesMove[] = [];
  for (const [dr, dc] of DIRS) {
    if (!king) {
      const forward = seat === 0 ? -1 : 1;
      if (dr !== forward) continue;
      const r = r0 + dr, c = c0 + dc;
      if (inside(r, c) && board[r * 10 + c] === 0) res.push({ from, path: [r * 10 + c], captures: [] });
    } else {
      let r = r0 + dr, c = c0 + dc;
      while (inside(r, c) && board[r * 10 + c] === 0) {
        res.push({ from, path: [r * 10 + c], captures: [] });
        r += dr;
        c += dc;
      }
    }
  }
  return res;
}

export function sideHasMove(s: DamesState, seat: number = s.turn): boolean {
  if (s.over) return false;
  for (let i = 0; i < 100; i++) {
    if (s.board[i] === 0 || sideOf(s.board[i]) !== seat) continue;
    if (simpleMoves(s.board, i).length) return true;
    if (captureSteps(s.board, i, seat, Math.abs(s.board[i]) === 2, []).length) return true;
  }
  return false;
}

export function legalMoves(s: DamesState, seat: number = s.turn): DamesMove[] {
  if (s.over) return [];
  const budget = { nodes: 0 };
  let caps: DamesMove[] = [];
  for (let i = 0; i < 100; i++) {
    if (s.board[i] !== 0 && sideOf(s.board[i]) === seat) caps.push(...capturesFrom(s.board, i, budget));
    if (budget.nodes > CAPTURE_BUDGET) break;
  }
  if (caps.length) {
    const max = Math.max(...caps.map((m) => m.captures.length));
    caps = caps.filter((m) => m.captures.length === max);
    // dédoublonnage (même trajet)
    const seen = new Set<string>();
    return caps.filter((m) => {
      const k = m.from + ":" + m.path.join(",");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  const res: DamesMove[] = [];
  for (let i = 0; i < 100; i++) if (s.board[i] !== 0 && sideOf(s.board[i]) === seat) res.push(...simpleMoves(s.board, i));
  return res;
}

function applyRaw(s: DamesState, m: DamesMove): DamesState {
  const b = s.board.slice();
  const piece = b[m.from];
  b[m.from] = 0;
  for (const c of m.captures) b[c] = 0;
  const to = m.path[m.path.length - 1];
  let np = piece;
  const row = Math.floor(to / 10);
  if (piece === 1 && row === 0) np = 2;
  if (piece === -1 && row === 9) np = -2;
  b[to] = np;
  const kingQuiet = Math.abs(piece) === 2 && m.captures.length === 0;
  const n: DamesState = {
    board: b,
    turn: (1 - s.turn) as 0 | 1,
    quiet: kingQuiet ? s.quiet + 1 : 0,
    moves: s.moves + 1,
    over: false,
    winner: null,
    draw: false,
    last: m,
  };
  if (n.quiet >= DAMES_DRAW_QUIET) {
    n.over = true;
    n.draw = true;
  } else if (!sideHasMove(n, n.turn)) {
    n.over = true;
    n.winner = s.turn;
  }
  return n;
}

function evaluate(b: number[], seat: number): number {
  let v = 0;
  for (let i = 0; i < 100; i++) {
    const p = b[i];
    if (!p) continue;
    const r = Math.floor(i / 10);
    let val = Math.abs(p) === 2 ? 320 : 100;
    if (p === 1) val += (9 - r) * 3;
    if (p === -1) val += r * 3;
    const c = i % 10;
    if (c >= 3 && c <= 6) val += 4;
    v += sideOf(p) === seat ? val : -val;
  }
  return v;
}

export function sameMove(a: DamesMove, b: { from: number; path: number[] }) {
  return a.from === b.from && a.path.length === b.path.length && a.path.every((x, i) => x === b.path[i]);
}

export const sqName = (i: number) => {
  // numérotation officielle 1..50 des cases foncées
  return String(Math.floor(i / 2) + 1);
};

export const dames: Engine<DamesState, { from: number; path: number[] }> = {
  init() {
    return { board: initialBoard(), turn: 0, quiet: 0, moves: 0, over: false, winner: null, draw: false };
  },
  current(s) {
    return s.over ? null : s.turn;
  },
  apply(s, seat, move, names) {
    if (s.over) throw new GameError("La partie est terminée.");
    if (s.turn !== seat) throw new GameError("Ce n'est pas votre tour.");
    if (!move || typeof move.from !== "number" || !Array.isArray(move.path)) throw new GameError("Coup invalide.");
    const legal = legalMoves(s, seat).find((m) => sameMove(m, move));
    if (!legal) throw new GameError("Coup illégal (la prise maximale est obligatoire).");
    const n = applyRaw(s, legal);
    const to = legal.path[legal.path.length - 1];
    const log = [
      `${names[seat]} : ${sqName(legal.from)}${legal.captures.length ? "x" : "-"}${sqName(to)}${
        legal.captures.length ? ` (${legal.captures.length} prise${legal.captures.length > 1 ? "s" : ""})` : ""
      }`,
    ];
    if (n.over) log.push(n.draw ? "Match nul (50 coups de dames sans prise)" : `${names[seat]} gagne : l'adversaire ne peut plus jouer`);
    return { state: n, log };
  },
  result(s): GameResult {
    return { over: s.over, winner: s.winner, draw: s.draw };
  },
  ai(s, seat) {
    const moves = legalMoves(s, seat);
    if (!moves.length) return { from: 0, path: [] };
    if (moves.length === 1) return { from: moves[0].from, path: moves[0].path };
    // Un seul coup d'avance : l'ancienne recherche profonde bloquait la partie en ligne.
    const sample = moves.slice(0, 16);
    let best = sample[0];
    let bestV = -Infinity;
    for (const m of sample) {
      const n = applyRaw(s, m);
      const v = n.over ? (n.draw ? 0 : n.winner === seat ? 5000 : -5000) : evaluate(n.board, seat);
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    return { from: best.from, path: best.path };
  },
  resign(s) {
    return s;
  },
};
