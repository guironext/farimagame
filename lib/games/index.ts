import type { GameId } from "../types";
import type { Engine } from "./engine";
import { awale } from "./awale";
import { dames } from "./dames";
import { echecs } from "./echecs";
import { ludo } from "./ludo";
import { race } from "./race";
import { run } from "./run";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ENGINES: Record<GameId, Engine<any, any>> = { awale, course: race, dames, echecs, ludo, run };
