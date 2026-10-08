// Échecs : règles complètes via la bibliothèque chess.js
// Joueur 0 = Blancs, joueur 1 = Noirs.
import { Chess, type Move } from "chess.js";
import { Engine, GameError, GameResult } from "./engine";

export interface EchecsMove {
  from: string;
  to: string;
  promotion?: string;
}

export interface EchecsState {
  moves: EchecsMove[];
  san: string[];
  fen: string;
  over: boolean;
  winner: number | null;
  draw: boolean;
  reason?: string;
  last?: EchecsMove;
}

export function rebuild(s: EchecsState): Chess {
  const c = new Chess();
  for (const m of s.moves) c.move(m);
  return c;
}

const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const CENTER = (sq: string) => {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  return 6 - (Math.abs(3.5 - f) + Math.abs(3.5 - r));
};

function evaluate(c: Chess, color: "w" | "b"): number {
  let v = 0;
  const board = c.board();
  for (const row of board)
    for (const sq of row) {
      if (!sq) continue;
      let val = VAL[sq.type];
      if (sq.type === "n" || sq.type === "b" || sq.type === "p") val += CENTER(sq.square) * 3;
      if (sq.type === "p") val += (sq.color === "w" ? Number(sq.square[1]) - 2 : 7 - Number(sq.square[1])) * 4;
      v += sq.color === color ? val : -val;
    }
  return v;
}

function moveScore(m: Move) {
  let v = 0;
  if (m.captured) v += 10 * VAL[m.captured] - VAL[m.piece];
  if (m.promotion) v += 800;
  return v;
}

function order(moves: Move[]) {
  return moves.sort((a, b) => moveScore(b) - moveScore(a));
}

function negamax(c: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0) return evaluate(c, c.turn());
  const moves = c.moves({ verbose: true });
  if (moves.length === 0) return c.inCheck() ? -100000 - depth : 0;
  let best = -Infinity;
  for (const m of order(moves)) {
    c.move({ from: m.from, to: m.to, promotion: m.promotion });
    const v = -negamax(c, depth - 1, -beta, -alpha);
    c.undo();
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function finalize(c: Chess, s: EchecsState) {
  if (c.isCheckmate()) {
    s.over = true;
    s.winner = c.turn() === "w" ? 1 : 0;
    s.reason = "Échec et mat";
  } else if (c.isStalemate()) {
    s.over = true;
    s.draw = true;
    s.reason = "Pat";
  } else if (c.isInsufficientMaterial()) {
    s.over = true;
    s.draw = true;
    s.reason = "Matériel insuffisant";
  } else if (c.isThreefoldRepetition()) {
    s.over = true;
    s.draw = true;
    s.reason = "Triple répétition";
  } else if (c.isDraw()) {
    s.over = true;
    s.draw = true;
    s.reason = "Règle des 50 coups";
  }
}

export const echecs: Engine<EchecsState, EchecsMove> = {
  init() {
    return { moves: [], san: [], fen: new Chess().fen(), over: false, winner: null, draw: false };
  },
  current(s) {
    if (s.over) return null;
    return s.fen.split(" ")[1] === "w" ? 0 : 1;
  },
  apply(s, seat, move, names) {
    if (s.over) throw new GameError("La partie est terminée.");
    const c = rebuild(s);
    const turnSeat = c.turn() === "w" ? 0 : 1;
    if (turnSeat !== seat) throw new GameError("Ce n'est pas votre tour.");
    if (!move || typeof move.from !== "string" || typeof move.to !== "string") throw new GameError("Coup invalide.");
    const promo = move.promotion && ["q", "r", "b", "n"].includes(move.promotion) ? move.promotion : undefined;
    const legal = c.moves({ verbose: true }).find((m) => m.from === move.from && m.to === move.to && (!m.promotion || m.promotion === (promo ?? "q")));
    if (!legal) throw new GameError("Coup illégal.");
    const mv: EchecsMove = { from: legal.from, to: legal.to, ...(legal.promotion ? { promotion: legal.promotion } : {}) };
    const done = c.move(mv);
    const n: EchecsState = { ...s, moves: [...s.moves, mv], san: [...s.san, done.san], fen: c.fen(), last: mv, over: false, winner: null, draw: false };
    finalize(c, n);
    const log = [`${names[seat]} : ${done.san}`];
    if (n.over) log.push(n.reason ?? "Fin de partie");
    else if (c.inCheck()) log.push("Échec !");
    return { state: n, log };
  },
  result(s): GameResult {
    return { over: s.over, winner: s.winner, draw: s.draw };
  },
  ai(s) {
    const c = rebuild(s);
    const moves = order(c.moves({ verbose: true }));
    let pieces = 0;
    for (const row of c.board()) for (const sq of row) if (sq) pieces++;
    const depth = pieces <= 10 ? 3 : 2;
    let best = moves[0];
    let bestV = -Infinity;
    for (const m of moves) {
      c.move({ from: m.from, to: m.to, promotion: m.promotion });
      const v = c.isCheckmate() ? 1e9 : -negamax(c, depth, -Infinity, -(bestV - 8)) + Math.random() * 8;
      c.undo();
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    return { from: best.from, to: best.to, ...(best.promotion ? { promotion: best.promotion } : {}) };
  },
  resign(s) {
    return s;
  },
};
