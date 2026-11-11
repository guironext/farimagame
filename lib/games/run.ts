// Endless Run : trois voies, la course avance toute seule.
// Bas = il faut sauter. Haut = il faut glisser. Mur = il faut changer de voie.
// La distance est recalculée par le serveur à partir des actions : elle ne se déclare pas.
import { Engine, GameError, GameResult } from "./engine";

export const RUN_MAX = 400;
export const RUN_LANES = 3;
export type RunAction = "." | "j" | "s" | "l" | "r";
export type ObstacleKind = "low" | "high" | "block";

export interface Obstacle {
  lane: number;
  kind: ObstacleKind;
}

export interface Runner {
  lane: number;
  jump: number;
  slide: number;
}

export interface RunState {
  seed: number;
  turn: 0 | 1;
  scores: [number | null, number | null];
  over: boolean;
  winner: number | null;
  draw: boolean;
  moves: number;
}

export interface RunMove {
  actions: RunAction[];
}

function hash(seed: number, n: number) {
  let x = Math.imul(seed ^ n, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  return (x ^ (x >>> 13)) >>> 0;
}

export function course(seed: number): (Obstacle | null)[] {
  const out: (Obstacle | null)[] = Array(RUN_MAX + 1).fill(null);
  let at = 8;
  let i = 0;
  while (at <= RUN_MAX) {
    const kinds: ObstacleKind[] = ["low", "high", "block"];
    out[at] = { lane: hash(seed, i) % RUN_LANES, kind: kinds[hash(seed, i + 97) % 3] };
    at += 4 + (hash(seed, i + 53) % 4);
    i += 1;
  }
  return out;
}

export function startRunner(): Runner {
  return { lane: 1, jump: 0, slide: 0 };
}

/** Un pas. L'obstacle du pas est testé après l'action, avant de diminuer le saut ou la glissade. */
export function step(obstacle: Obstacle | null, runner: Runner, action: RunAction): { runner: Runner; crashed: boolean } {
  let { lane, jump, slide } = runner;
  if (action === "l" && lane > 0) lane -= 1;
  else if (action === "r" && lane < RUN_LANES - 1) lane += 1;
  else if (action === "j" && jump === 0 && slide === 0) jump = 3;
  else if (action === "s" && jump === 0 && slide === 0) slide = 2;
  const crashed =
    !!obstacle &&
    obstacle.lane === lane &&
    (obstacle.kind === "block" || (obstacle.kind === "low" && jump === 0) || (obstacle.kind === "high" && slide === 0));
  if (!crashed) {
    if (jump > 0) jump -= 1;
    else if (slide > 0) slide -= 1;
  }
  return { runner: { lane, jump, slide }, crashed };
}

export function replay(seed: number, actions: RunAction[]) {
  const track = course(seed);
  let runner = startRunner();
  for (let t = 0; t < actions.length && t <= RUN_MAX; t++) {
    const moved = step(track[t] ?? null, runner, actions[t]);
    if (moved.crashed) return { distance: t, crashed: true };
    runner = moved.runner;
    if (t === RUN_MAX) return { distance: RUN_MAX, crashed: false };
  }
  return { distance: Math.min(actions.length, RUN_MAX), crashed: false };
}

function isAction(value: unknown): value is RunAction {
  return value === "." || value === "j" || value === "s" || value === "l" || value === "r";
}

/** L'ordinateur joue juste, puis cesse d'éviter à partir d'une distance fixe pour cette piste. */
export function cpuActions(seed: number): RunAction[] {
  const track = course(seed);
  const giveUpAt = 36 + (hash(seed, 7) % 70);
  const actions: RunAction[] = [];
  let runner = startRunner();
  for (let t = 0; t <= RUN_MAX; t++) {
    const obstacle = track[t] ?? null;
    let action: RunAction = ".";
    if (obstacle && t < giveUpAt) {
      if (obstacle.kind === "block") {
        if (runner.lane === obstacle.lane) action = runner.lane === 0 ? "r" : "l";
      } else if (obstacle.lane === runner.lane && runner.jump === 0 && runner.slide === 0) {
        action = obstacle.kind === "low" ? "j" : "s";
      }
    }
    actions.push(action);
    const moved = step(obstacle, runner, action);
    if (moved.crashed || t === RUN_MAX) return actions;
    runner = moved.runner;
  }
  return actions;
}

export const run: Engine<RunState, RunMove> = {
  init() {
    return {
      seed: Math.floor(Math.random() * 1_000_000_000),
      turn: 0,
      scores: [null, null],
      over: false,
      winner: null,
      draw: false,
      moves: 0,
    };
  },
  current(s) {
    return s.over ? null : s.turn;
  },
  apply(s, seat, move, names) {
    if (s.over) throw new GameError("La partie est terminée.");
    if (s.turn !== seat) throw new GameError("Ce n'est pas votre tour.");
    if (s.scores[seat] != null) throw new GameError("Vous avez déjà couru.");
    const actions = move?.actions;
    if (!Array.isArray(actions) || actions.length < 1 || actions.length > RUN_MAX + 1 || !actions.every(isAction)) {
      throw new GameError("Course invalide.");
    }
    const result = replay(s.seed, actions);
    if (!result.crashed && result.distance < RUN_MAX) throw new GameError("La course n'est pas terminée.");
    const scores: [number | null, number | null] = [s.scores[0], s.scores[1]];
    scores[seat] = result.distance;
    const other = (1 - seat) as 0 | 1;
    const done = scores[other] != null;
    let winner: number | null = null;
    let draw = false;
    if (done) {
      const a = scores[0] ?? 0;
      const b = scores[1] ?? 0;
      if (a === b) draw = true;
      else winner = a > b ? 0 : 1;
    }
    const next: RunState = {
      seed: s.seed,
      turn: done ? s.turn : other,
      scores,
      over: done,
      winner,
      draw,
      moves: s.moves + 1,
    };
    const log = [`${names[seat]} court ${result.distance} m${result.crashed ? "" : " et finit la piste"}`];
    if (done) {
      log.push(draw ? "Même distance : match nul" : `${names[winner ?? 0]} gagne la course`);
    }
    return { state: next, log };
  },
  result(s): GameResult {
    return { over: s.over, winner: s.winner, draw: s.draw };
  },
  ai(s) {
    return { actions: cpuActions(s.seed) };
  },
  resign(s) {
    return s;
  },
};
