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

function capturesFrom(board: number[], from: number): DamesMove[] {
  const piece = board[from];
  const seat = sideOf(piece);
  const king = Math.abs(piece) === 2;
  const results: DamesMove[] = [];
  const b = board.slice();
  b[from] = 0; // la pièce quitte sa case de départ

  const dfs = (pos: number, path: number[], caps: number[]) => {
    const r0 = Math.floor(pos / 10);
    const c0 = pos % 10;
    let extended = false;
    for (const [dr, dc] of DIRS) {
      if (!king) {
        const mr = r0 + dr, mc = c0 + dc, lr = r0 + 2 * dr, lc = c0 + 2 * dc;
        if (!inside(lr, lc)) continue;
        const mid = mr * 10 + mc, land = lr * 10 + lc;
        if (b[mid] !== 0 && sideOf(b[mid]) !== seat && !caps.includes(mid) && b[land] === 0) {
          extended = true;
          dfs(land, [...path, land], [...caps, mid]);
        }
      } else {
        let r = r0 + dr, c = c0 + dc;
        while (inside(r, c) && b[r * 10 + c] === 0) {
          r += dr;
          c += dc;
        }
        if (!inside(r, c)) continue;
        const mid = r * 10 + c;
        if (sideOf(b[mid]) === seat || caps.includes(mid)) continue;
        let lr = r + dr, lc = c + dc;
        while (inside(lr, lc) && b[lr * 10 + lc] === 0) {
          const land = lr * 10 + lc;
          extended = true;
          dfs(land, [...path, land], [...caps, mid]);
          lr += dr;
          lc += dc;
        }
      }
    }
    if (!extended && caps.length > 0) results.push({ from, path, captures: caps });
  };
  dfs(from, [], []);
  return results;
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

export function legalMoves(s: DamesState, seat: number = s.turn): DamesMove[] {
  if (s.over) return [];
  let caps: DamesMove[] = [];
  for (let i = 0; i < 100; i++) if (s.board[i] !== 0 && sideOf(s.board[i]) === seat) caps.push(...capturesFrom(s.board, i));
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
  } else if (legalMoves(n, n.turn).length === 0) {
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

function negamax(s: DamesState, depth: number, alpha: number, beta: number): number {
  const seat = s.turn;
  if (s.over) return s.draw ? 0 : s.winner === seat ? 100000 + depth : -100000 - depth;
  if (depth === 0) return evaluate(s.board, seat);
  const moves = legalMoves(s, seat);
  let best = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyRaw(s, m), depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
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
    if (moves.length === 1) return { from: moves[0].from, path: moves[0].path };
    let pieces = 0;
    for (const p of s.board) if (p) pieces++;
    const depth = pieces < 12 ? 5 : 4;
    let best = moves[0];
    let bestV = -Infinity;
    for (const m of moves) {
      const v = -negamax(applyRaw(s, m), depth - 1, -Infinity, Infinity) + Math.random() * 2;
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
