// Course auto : trois voies jusqu'à la ligne d'arrivée.
// Le temps est recalculé par le serveur à partir des actions : il ne se déclare pas.
import { Engine, GameError, GameResult } from "./engine";

export const RACE_FINISH = 120;
export const RACE_LANES = 3;
export const RACE_MAX_ACTIONS = RACE_FINISH * 2;

export type RaceAction = "." | "+" | "-" | "l" | "r";
export type HazardKind = "wall" | "boost";

export interface Hazard {
  lane: number;
  kind: HazardKind;
}

export interface Car {
  lane: number;
  speed: number;
  pos: number;
  /** Tours restants à vitesse 1 après un choc. */
  grip: number;
}

export interface RaceScore {
  time: number;
  hits: number;
}

export interface RaceState {
  seed: number;
  turn: 0 | 1;
  scores: [RaceScore | null, RaceScore | null];
  /** Actions déjà déposées, pour rejouer la voiture adverse. */
  runs: [RaceAction[] | null, RaceAction[] | null];
  over: boolean;
  winner: number | null;
  draw: boolean;
  moves: number;
}

export interface RaceMove {
  actions: RaceAction[];
}

const ACTIONS: RaceAction[] = [".", "+", "-", "l", "r"];

function hash(seed: number, n: number) {
  let x = Math.imul(seed ^ n, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  return (x ^ (x >>> 13)) >>> 0;
}

export function course(seed: number): (Hazard | null)[] {
  const out: (Hazard | null)[] = Array(RACE_FINISH + 1).fill(null);
  let at = 10;
  let i = 0;
  while (at < RACE_FINISH - 2) {
    const kind: HazardKind = hash(seed, i + 11) % 5 === 0 ? "boost" : "wall";
    out[at] = { lane: hash(seed, i) % RACE_LANES, kind };
    at += 6 + (hash(seed, i + 3) % 4);
    i += 1;
  }
  return out;
}

export function startCar(): Car {
  return { lane: 1, speed: 1, pos: 0, grip: 0 };
}

export function step(track: (Hazard | null)[], car: Car, action: RaceAction): { car: Car; hit: boolean } {
  let lane = car.lane;
  let speed = car.speed;
  let pos = car.pos;
  let grip = car.grip;
  if (grip > 0) {
    speed = 1;
    grip -= 1;
  } else if (action === "l" && lane > 0) lane -= 1;
  else if (action === "r" && lane < RACE_LANES - 1) lane += 1;
  else if (action === "+" && speed < 3) speed += 1;
  else if (action === "-" && speed > 1) speed -= 1;

  let left = speed;
  let hit = false;
  while (left > 0 && pos < RACE_FINISH) {
    pos += 1;
    left -= 1;
    const hazard = track[pos];
    if (!hazard || hazard.lane !== lane) continue;
    if (hazard.kind === "wall") {
      speed = 1;
      grip = 8;
      hit = true;
      break;
    }
    speed = Math.min(3, speed + 1);
  }
  return { car: { lane, speed, pos, grip }, hit };
}

function isAction(value: unknown): value is RaceAction {
  return typeof value === "string" && ACTIONS.includes(value as RaceAction);
}

export function replay(seed: number, actions: RaceAction[]): { time: number; hits: number; distance: number; finished: boolean } {
  const track = course(seed);
  let car = startCar();
  let hits = 0;
  let used = 0;
  for (const action of actions) {
    if (car.pos >= RACE_FINISH) break;
    const moved = step(track, car, action);
    car = moved.car;
    if (moved.hit) hits += 1;
    used += 1;
  }
  return { time: used, hits, distance: car.pos, finished: car.pos >= RACE_FINISH };
}

export function cpuPlan(seed: number): RaceAction[] {
  const track = course(seed);
  let car = startCar();
  const actions: RaceAction[] = [];
  while (car.pos < RACE_FINISH && actions.length < RACE_MAX_ACTIONS) {
    const blocked = (lane: number, dist: number) => {
      for (let d = 1; d <= dist; d += 1) {
        const hazard = track[car.pos + d];
        if (hazard && hazard.kind === "wall" && hazard.lane === lane) return true;
      }
      return false;
    };
    let action: RaceAction = ".";
    const dodge = hash(seed, actions.length + 9) % 100 >= 18;
    if (blocked(car.lane, car.speed)) {
      if (dodge && car.lane > 0 && !blocked(car.lane - 1, car.speed)) action = "l";
      else if (dodge && car.lane < 2 && !blocked(car.lane + 1, car.speed)) action = "r";
      else if (dodge && car.speed > 1) action = "-";
    } else if (car.speed < 2 && !blocked(car.lane, car.speed + 1)) {
      action = "+";
    }
    actions.push(action);
    car = step(track, car, action).car;
  }
  return actions;
}

function rank(scores: [RaceScore | null, RaceScore | null]): { winner: number | null; draw: boolean } {
  const a = scores[0];
  const b = scores[1];
  if (!a || !b) return { winner: null, draw: false };
  if (a.time === b.time) return { winner: null, draw: true };
  return { winner: a.time < b.time ? 0 : 1, draw: false };
}

export const race: Engine<RaceState, RaceMove> = {
  init() {
    return {
      seed: Math.floor(Math.random() * 1_000_000_000),
      turn: 0,
      scores: [null, null],
      runs: [null, null],
      over: false,
      winner: null,
      draw: false,
      moves: 0,
    };
  },
  current(s) {
    if (s.over) return null;
    if (s.scores[0] == null) return 0;
    if (s.scores[1] == null) return 1;
    return null;
  },
  apply(s, seat, move, names) {
    if (s.over) throw new GameError("La partie est terminée.");
    if (seat !== 0 && seat !== 1) throw new GameError("Place invalide.");
    if (s.scores[seat] != null) throw new GameError("Vous avez déjà couru.");
    const actions = move?.actions;
    if (!Array.isArray(actions) || actions.length < 1 || actions.length > RACE_MAX_ACTIONS || !actions.every(isAction)) {
      throw new GameError("Course invalide.");
    }
    const result = replay(s.seed, actions);
    if (!result.finished) throw new GameError("La course n'est pas terminée.");
    const scores: [RaceScore | null, RaceScore | null] = [s.scores[0], s.scores[1]];
    scores[seat] = { time: result.time, hits: result.hits };
    const runs: [RaceAction[] | null, RaceAction[] | null] = [s.runs?.[0] ?? null, s.runs?.[1] ?? null];
    runs[seat] = actions;
    const other = (1 - seat) as 0 | 1;
    const done = scores[other] != null;
    const ranked = done ? rank(scores) : { winner: null, draw: false };
    const next: RaceState = {
      seed: s.seed,
      turn: done ? s.turn : other,
      scores,
      runs,
      over: done,
      winner: ranked.winner,
      draw: ranked.draw,
      moves: s.moves + 1,
    };
    const log = [`${names[seat]} franchit la ligne en ${result.time} temps, ${result.hits} choc${result.hits > 1 ? "s" : ""}`];
    if (done) log.push(ranked.draw ? "Même temps : match nul" : `${names[ranked.winner ?? 0]} arrive le premier`);
    return { state: next, log };
  },
  result(s): GameResult {
    return { over: s.over, winner: s.winner, draw: s.draw };
  },
  ai(s) {
    return { actions: cpuPlan(s.seed) };
  },
  resign(s) {
    return s;
  },
};
