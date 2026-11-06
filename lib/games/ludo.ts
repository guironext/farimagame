// Ludo — règles standard
// - 4 pions par joueur. Un 6 est nécessaire pour sortir un pion de la base.
// - Un 6 donne un nouveau lancer ; trois 6 d'affilée font perdre le tour.
// - Arriver sur une case occupée par un pion adverse le renvoie à sa base (sauf cases sûres ★
//   et cases de départ). Une capture ou l'arrivée d'un pion à la maison donne un lancer bonus.
// - Le parcours fait 51 cases puis 5 cases dans le couloir de couleur ; il faut le nombre exact
//   pour entrer à la maison (case 56).
// - Le premier joueur qui ramène ses 4 pions gagne. (Pas de "blocs" dans cette version.)
import { Engine, GameError, GameResult } from "./engine";

export const LUDO_COLORS = ["rouge", "vert", "jaune", "bleu"] as const;
export const COLOR_START = [0, 13, 26, 39];
export const SAFE_GLOBALS = [0, 8, 13, 21, 26, 34, 39, 47];
export const HOME = 56;
export const LAST_TRACK = 50;

export interface LudoState {
  colors: number[]; // index de couleur par siège
  tokens: number[][]; // -1 base, 0..50 parcours, 51..55 couloir, 56 maison
  turn: number;
  phase: "roll" | "move";
  dice: number | null;
  lastRoll: { seat: number; value: number } | null;
  /** Nombre de lancers. N'augmente pas quand un pion avance. */
  rolls: number;
  sixes: number;
  active: boolean[];
  over: boolean;
  winner: number | null;
  moves: number;
}

export type LudoMove = { type: "roll" } | { type: "move"; token: number };

export function colorsFor(n: number): number[] {
  if (n === 2) return [0, 2];
  if (n === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

export const globalOf = (color: number, rel: number) => (COLOR_START[color] + rel) % 52;

export function movableTokens(s: LudoState, seat: number, d: number): number[] {
  const res: number[] = [];
  s.tokens[seat].forEach((p, i) => {
    if (p === HOME) return;
    if (p === -1) {
      if (d === 6) res.push(i);
    } else if (p + d <= HOME) res.push(i);
  });
  return res;
}

function nextSeat(s: LudoState, from: number): number {
  const n = s.tokens.length;
  for (let k = 1; k <= n; k++) {
    const c = (from + k) % n;
    if (s.active[c]) return c;
  }
  return from;
}

function clone(s: LudoState): LudoState {
  return { ...s, tokens: s.tokens.map((t) => t.slice()), active: s.active.slice(), colors: s.colors.slice() };
}

function endTurn(s: LudoState) {
  s.turn = nextSeat(s, s.turn);
  s.phase = "roll";
  s.dice = null;
  s.sixes = 0;
}

function moveToken(s: LudoState, seat: number, token: number, d: number, names: string[], log: string[]) {
  const p = s.tokens[seat][token];
  const np = p === -1 ? 0 : p + d;
  s.tokens[seat][token] = np;
  s.moves++;
  let bonus = false;
  if (p === -1) log.push(`${names[seat]} sort un pion`);
  if (np <= LAST_TRACK) {
    const g = globalOf(s.colors[seat], np);
    if (!SAFE_GLOBALS.includes(g)) {
      s.tokens.forEach((toks, os) => {
        if (os === seat) return;
        toks.forEach((op, oi) => {
          if (op >= 0 && op <= LAST_TRACK && globalOf(s.colors[os], op) === g) {
            s.tokens[os][oi] = -1;
            bonus = true;
            log.push(`${names[seat]} capture un pion de ${names[os]} !`);
          }
        });
      });
    }
  }
  if (np === HOME) {
    bonus = true;
    log.push(`${names[seat]} ramène un pion à la maison`);
    if (s.tokens[seat].every((t) => t === HOME)) {
      s.over = true;
      s.winner = seat;
      log.push(`${names[seat]} a gagné la partie !`);
      return;
    }
  }
  if (d === 6 || bonus) {
    s.phase = "roll";
    s.dice = null;
    if (d !== 6) s.sixes = 0;
  } else endTurn(s);
}

function inDanger(s: LudoState, seat: number, rel: number): boolean {
  if (rel < 0 || rel > LAST_TRACK) return false;
  const g = globalOf(s.colors[seat], rel);
  if (SAFE_GLOBALS.includes(g)) return false;
  for (let os = 0; os < s.tokens.length; os++) {
    if (os === seat || !s.active[os]) continue;
    for (const op of s.tokens[os]) {
      if (op < 0 || op > LAST_TRACK) continue;
      const og = globalOf(s.colors[os], op);
      const dist = (g - og + 52) % 52;
      if (dist >= 1 && dist <= 6 && op + dist <= LAST_TRACK) return true;
    }
  }
  return false;
}

function scoreMove(s: LudoState, seat: number, token: number, d: number): number {
  const p = s.tokens[seat][token];
  const np = p === -1 ? 0 : p + d;
  let v = np / 5;
  if (np === HOME) v += 100;
  if (p === -1) v += 40;
  if (np > LAST_TRACK && p <= LAST_TRACK) v += 25;
  if (np <= LAST_TRACK) {
    const g = globalOf(s.colors[seat], np);
    if (SAFE_GLOBALS.includes(g)) v += 15;
    else {
      for (let os = 0; os < s.tokens.length; os++) {
        if (os === seat) continue;
        for (const op of s.tokens[os]) if (op >= 0 && op <= LAST_TRACK && globalOf(s.colors[os], op) === g) v += 60;
      }
    }
  }
  if (inDanger(s, seat, p)) v += 20;
  if (inDanger(s, seat, np)) v -= 25;
  return v + Math.random();
}

export const ludo: Engine<LudoState, LudoMove> = {
  init(n) {
    return {
      colors: colorsFor(n),
      tokens: Array.from({ length: n }, () => [-1, -1, -1, -1]),
      turn: 0,
      phase: "roll",
      dice: null,
      lastRoll: null,
      rolls: 0,
      sixes: 0,
      active: Array(n).fill(true),
      over: false,
      winner: null,
      moves: 0,
    };
  },
  current(s) {
    return s.over ? null : s.turn;
  },
  apply(s0, seat, move, names) {
    if (s0.over) throw new GameError("La partie est terminée.");
    if (s0.turn !== seat) throw new GameError("Ce n'est pas votre tour.");
    const s = clone(s0);
    const log: string[] = [];
    if (move?.type === "roll") {
      if (s.phase !== "roll") throw new GameError("Vous devez d'abord déplacer un pion.");
      const d = 1 + Math.floor(Math.random() * 6);
      s.lastRoll = { seat, value: d };
      s.rolls = (s.rolls ?? 0) + 1;
      log.push(`${names[seat]} lance le dé : ${d}`);
      if (d === 6) {
        s.sixes++;
        if (s.sixes >= 3) {
          log.push(`Trois 6 d'affilée : ${names[seat]} passe son tour`);
          endTurn(s);
          return { state: s, log };
        }
      }
      const mv = movableTokens(s, seat, d);
      if (mv.length === 0) {
        log.push(`${names[seat]} ne peut pas jouer`);
        endTurn(s);
      } else {
        // Le joueur choisit lui-même le pion, même s'il n'y en a qu'un.
        s.phase = "move";
        s.dice = d;
      }
      return { state: s, log };
    }
    if (move?.type === "move") {
      if (s.phase !== "move" || s.dice == null) throw new GameError("Lancez d'abord le dé.");
      const t = Number(move.token);
      if (!movableTokens(s, seat, s.dice).includes(t)) throw new GameError("Ce pion ne peut pas bouger.");
      moveToken(s, seat, t, s.dice, names, log);
      return { state: s, log };
    }
    throw new GameError("Action inconnue.");
  },
  result(s): GameResult {
    return { over: s.over, winner: s.winner, draw: false };
  },
  ai(s, seat) {
    if (s.phase === "roll") return { type: "roll" };
    const mv = movableTokens(s, seat, s.dice ?? 0);
    let best = mv[0];
    let bv = -Infinity;
    for (const t of mv) {
      const v = scoreMove(s, seat, t, s.dice ?? 0);
      if (v > bv) {
        bv = v;
        best = t;
      }
    }
    return { type: "move", token: best };
  },
  resign(s0, seat) {
    const s = clone(s0);
    s.active[seat] = false;
    s.tokens[seat] = s.tokens[seat].map(() => -1);
    const left = s.active.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
    if (left.length === 1) {
      s.over = true;
      s.winner = left[0];
    } else if (s.turn === seat) endTurn(s);
    return s;
  },
};
