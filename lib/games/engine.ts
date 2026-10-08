export class GameError extends Error {}

export interface GameResult {
  over: boolean;
  winner: number | null;
  draw: boolean;
}

export interface Engine<S, M> {
  init(players: number): S;
  current(s: S): number | null;
  apply(s: S, seat: number, move: M, names: string[]): { state: S; log: string[] };
  result(s: S): GameResult;
  ai(s: S, seat: number): M;
  /** abandon d'un joueur (utile pour le Ludo à 3-4). Renvoie le nouvel état. */
  resign(s: S, seat: number): S;
}
