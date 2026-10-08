import { createApiFootballProvider } from "./apiFootball";
import { demoProvider } from "./demo";
import type { SportsProvider } from "./types";

/** Source des matchs : API-Football si API_FOOTBALL_KEY est défini, sinon données de démonstration. */
export function getSportsProvider(): SportsProvider {
  const key = process.env.API_FOOTBALL_KEY?.trim();
  return key ? createApiFootballProvider(key) : demoProvider;
}

export * from "./competitions";
export type { FixtureData, QuotaSnapshot, SportsProvider } from "./types";
