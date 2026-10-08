import type { LiveInfo, MatchStatus } from "../types";

/** Un match tel que fourni par une source de données (démo ou API réelle). */
export interface FixtureData {
  externalId: string;
  competitionId: string; // id de lib/sports/competitions.ts
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  kickoff: string; // ISO 8601 (UTC)
  status: MatchStatus;
  /** Score à la fin du temps réglementaire (90 min), utilisé pour régler les paris. */
  score: { home: number; away: number } | null;
  /** Score en direct, minute, période, mi-temps, buteurs… (absent si la source ne le fournit pas). */
  live?: LiveInfo;
  /** false si la source n'a pas fourni la liste des buts/cartons cette fois-ci (on garde alors la précédente). */
  eventsIncluded?: boolean;
  round?: string;
  venue?: string;
}

/** Consommation de l'API depuis le dernier appel à takeQuota(). */
export interface QuotaSnapshot {
  /** Nombre de requêtes HTTP envoyées. */
  requests: number;
  /** Requêtes restantes aujourd'hui selon l'en-tête x-ratelimit-requests-remaining (null si inconnu). */
  remaining: number | null;
  /** Quota quotidien selon l'en-tête x-ratelimit-requests-limit (null si inconnu). */
  limit: number | null;
}

export interface SportsProvider {
  id: "demo" | "api-football";
  label: string;
  isDemo: boolean;
  /** Intervalle minimal entre deux synchronisations complètes (pour respecter les quotas de l'API). */
  syncIntervalMs: number;
  fetchFixtures(from: Date, to: Date): Promise<FixtureData[]>;
  /**
   * Rafraîchissement « en direct » des matchs en cours (identifiants externes), en un minimum de requêtes.
   * Absent pour la démo : la synchronisation complète (gratuite) fournit déjà le direct.
   */
  fetchLive?(externalIds: string[]): Promise<FixtureData[]>;
  /** Intervalle de base entre deux rafraîchissements en direct (avant prise en compte du quota). */
  liveIntervalMs?: number;
  /** Renvoie puis remet à zéro le compteur de requêtes (suivi du quota quotidien). */
  takeQuota?(): QuotaSnapshot;
}
