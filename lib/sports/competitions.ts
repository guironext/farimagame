import type { CompetitionGroup, CompetitionView } from "../types";

export interface Competition extends CompetitionView {
  /** Identifiant de la compétition chez API-Football (api-sports.io). À vérifier avec GET /leagues?search=… */
  apiFootballId: number;
  /** "split" = saison à cheval sur deux années (août → mai) ; "calendar" = saison sur l'année civile. */
  seasonMode: "split" | "calendar";
}

// Les identifiants API-Football peuvent être remplacés sans toucher au code avec la variable
// d'environnement API_FOOTBALL_LEAGUES, ex. : API_FOOTBALL_LEAGUES="ci-ligue1=386,canq=36"
export const COMPETITIONS: Competition[] = [
  { id: "epl", name: "Premier League", short: "PL", group: "europe", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", apiFootballId: 39, seasonMode: "split" },
  { id: "laliga", name: "LaLiga", short: "Liga", group: "europe", country: "Espagne", flag: "🇪🇸", apiFootballId: 140, seasonMode: "split" },
  { id: "seriea", name: "Serie A", short: "Serie A", group: "europe", country: "Italie", flag: "🇮🇹", apiFootballId: 135, seasonMode: "split" },
  { id: "bundesliga", name: "Bundesliga", short: "Bundes.", group: "europe", country: "Allemagne", flag: "🇩🇪", apiFootballId: 78, seasonMode: "split" },
  { id: "ligue1", name: "Ligue 1", short: "L1", group: "europe", country: "France", flag: "🇫🇷", apiFootballId: 61, seasonMode: "split" },
  { id: "ucl", name: "Ligue des champions UEFA", short: "LDC", group: "ldc", country: "Europe", flag: "⭐", apiFootballId: 2, seasonMode: "split" },
  { id: "can", name: "Coupe d'Afrique des Nations", short: "CAN", group: "afrique", country: "Afrique", flag: "🌍", apiFootballId: 6, seasonMode: "calendar" },
  { id: "cafcl", name: "Ligue des champions CAF", short: "LDC CAF", group: "afrique", country: "Afrique", flag: "🏆", apiFootballId: 12, seasonMode: "split" },
  { id: "ci-ligue1", name: "Ligue 1 ivoirienne", short: "L1 CI", group: "afrique", country: "Côte d'Ivoire", flag: "🇨🇮", apiFootballId: 386, seasonMode: "split" },
  { id: "wcq-afr", name: "Éliminatoires Coupe du monde – Afrique", short: "Élim. CdM Afr.", group: "eliminatoires", country: "Afrique", flag: "🌍", apiFootballId: 29, seasonMode: "calendar" },
  { id: "wcq-eur", name: "Éliminatoires Coupe du monde – Europe", short: "Élim. CdM Eur.", group: "eliminatoires", country: "Europe", flag: "🇪🇺", apiFootballId: 32, seasonMode: "calendar" },
  { id: "canq", name: "Éliminatoires CAN", short: "Élim. CAN", group: "eliminatoires", country: "Afrique", flag: "🌍", apiFootballId: 36, seasonMode: "calendar" },
];

export const COMPETITION_BY_ID: Record<string, Competition> = Object.fromEntries(COMPETITIONS.map((c) => [c.id, c]));

export const GROUPS: { id: CompetitionGroup; label: string; emoji: string }[] = [
  { id: "europe", label: "Ligues européennes", emoji: "🇪🇺" },
  { id: "ldc", label: "Ligue des champions", emoji: "⭐" },
  { id: "afrique", label: "Matchs africains", emoji: "🌍" },
  { id: "eliminatoires", label: "Éliminatoires", emoji: "🎟️" },
];

export function competitionView(id: string): CompetitionView {
  const c = COMPETITION_BY_ID[id];
  if (!c) return { id, name: id, short: id, group: "europe", country: "", flag: "⚽" };
  return { id: c.id, name: c.name, short: c.short, group: c.group, country: c.country, flag: c.flag };
}
