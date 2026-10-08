// Base des équipes : note de force (échelle type Elo) + noms alternatifs.
// - Les noms servent à reconnaître une équipe quelle que soit la source : données de démo (noms français),
//   API-Football et The Odds API (noms anglais).
// - Les notes sont des estimations FarimaGame (inspirées des classements Elo publics, saison 2025-26).
//   Elles ne servent qu'à calculer les cotes de départ quand aucune cote bookmaker n'est disponible.
//   Les clubs et les sélections sont sur des échelles séparées (ils ne se rencontrent pas).
//   Ajustez-les librement : une ligne = [note, nom principal, ...alias].

type Entry = [number, ...string[]];

const CLUBS: Entry[] = [
  // ---------------------------------------------------------------- Angleterre
  [2040, "Liverpool", "Liverpool FC"],
  [2020, "Arsenal", "Arsenal FC"],
  [1995, "Manchester City", "Man City", "Manchester City FC"],
  [1940, "Chelsea", "Chelsea FC"],
  [1880, "Newcastle", "Newcastle United"],
  [1860, "Aston Villa"],
  [1835, "Tottenham", "Tottenham Hotspur", "Spurs"],
  [1830, "Manchester United", "Man United", "Manchester Utd"],
  [1825, "Brighton", "Brighton and Hove Albion", "Brighton & Hove Albion"],
  [1830, "Crystal Palace"],
  [1795, "Brentford"],
  [1780, "Fulham"],
  [1800, "Bournemouth", "AFC Bournemouth"],
  [1795, "Nottingham Forest", "Nottm Forest"],
  [1755, "West Ham", "West Ham United"],
  [1760, "Everton"],
  [1730, "Wolverhampton", "Wolverhampton Wanderers", "Wolves"],
  [1700, "Leeds United", "Leeds"],
  [1680, "Burnley"],
  [1690, "Sunderland", "Sunderland AFC"],
  // ---------------------------------------------------------------- Espagne
  [2000, "FC Barcelone", "Barcelona", "FC Barcelona", "Barça"],
  [1995, "Real Madrid"],
  [1925, "Atlético Madrid", "Atletico Madrid", "Atlético de Madrid"],
  [1850, "Athletic Bilbao", "Athletic Club"],
  [1790, "Real Sociedad"],
  [1835, "Villarreal"],
  [1810, "Betis Séville", "Real Betis", "Betis"],
  [1740, "FC Séville", "Sevilla", "Sevilla FC", "Séville"],
  [1730, "Valence", "Valencia", "Valencia CF"],
  [1720, "Girona", "Girona FC", "Gérone"],
  [1760, "Celta Vigo", "Celta de Vigo", "RC Celta"],
  [1750, "Osasuna", "CA Osasuna"],
  [1730, "Getafe", "Getafe CF"],
  [1720, "Majorque", "Mallorca", "RCD Mallorca"],
  [1750, "Rayo Vallecano"],
  [1710, "Alavés", "Deportivo Alavés", "Alaves"],
  [1720, "Espanyol", "RCD Espanyol"],
  [1670, "Levante", "Levante UD"],
  [1670, "Elche", "Elche CF"],
  [1640, "Real Oviedo", "Oviedo"],
  // ---------------------------------------------------------------- Italie
  [1960, "Inter Milan", "Inter", "Internazionale", "FC Internazionale"],
  [1860, "AC Milan", "Milan"],
  [1865, "Juventus", "Juventus FC"],
  [1905, "Naples", "Napoli", "SSC Napoli"],
  [1850, "AS Rome", "AS Roma", "Roma"],
  [1800, "Lazio", "SS Lazio"],
  [1870, "Atalanta", "Atalanta BC"],
  [1790, "Fiorentina", "ACF Fiorentina"],
  [1820, "Bologne", "Bologna", "Bologna FC"],
  [1740, "Torino", "Torino FC", "Turin"],
  [1730, "Udinese"],
  [1720, "Genoa", "Gênes"],
  [1790, "Côme", "Como", "Como 1907"],
  [1700, "Cagliari"],
  [1680, "Lecce", "US Lecce"],
  [1690, "Parme", "Parma", "Parma Calcio"],
  [1680, "Hellas Vérone", "Hellas Verona", "Verona"],
  [1700, "Sassuolo", "US Sassuolo"],
  [1650, "Pise", "Pisa", "Pisa SC"],
  [1660, "Cremonese", "US Cremonese"],
  // ---------------------------------------------------------------- Allemagne
  [2025, "Bayern Munich", "Bayern München", "FC Bayern München", "Bayern"],
  [1870, "Borussia Dortmund", "Dortmund"],
  [1875, "Bayer Leverkusen", "Leverkusen", "Bayer 04 Leverkusen"],
  [1825, "RB Leipzig", "Leipzig"],
  [1820, "Eintracht Francfort", "Eintracht Frankfurt", "Frankfurt"],
  [1810, "VfB Stuttgart", "Stuttgart"],
  [1780, "Fribourg", "SC Freiburg", "Freiburg"],
  [1730, "Wolfsburg", "VfL Wolfsburg"],
  [1760, "Mayence", "FSV Mainz 05", "Mainz 05", "Mainz", "1. FSV Mainz 05"],
  [1740, "Mönchengladbach", "Borussia Monchengladbach", "Borussia Mönchengladbach", "Gladbach"],
  [1730, "Werder Brême", "Werder Bremen", "SV Werder Bremen"],
  [1740, "Union Berlin", "1. FC Union Berlin"],
  [1720, "Augsbourg", "FC Augsburg", "Augsburg"],
  [1760, "Hoffenheim", "TSG Hoffenheim", "TSG 1899 Hoffenheim"],
  [1690, "Heidenheim", "1. FC Heidenheim", "FC Heidenheim"],
  [1700, "St. Pauli", "FC St. Pauli", "St Pauli"],
  [1690, "Cologne", "1. FC Köln", "FC Koln", "FC Köln", "Koln"],
  [1690, "Hambourg SV", "Hamburger SV", "Hamburg"],
  // ---------------------------------------------------------------- France
  [2010, "Paris Saint-Germain", "Paris Saint Germain", "PSG", "Paris SG"],
  [1840, "Olympique de Marseille", "Marseille", "OM"],
  [1820, "AS Monaco", "Monaco"],
  [1810, "LOSC Lille", "Lille", "LOSC", "Lille OSC"],
  [1770, "OGC Nice", "Nice"],
  [1800, "Olympique Lyonnais", "Lyon", "OL"],
  [1790, "RC Lens", "Lens"],
  [1760, "Stade Rennais", "Rennes", "Stade Rennais FC"],
  [1720, "Stade Brestois", "Brest", "Stade Brestois 29"],
  [1770, "RC Strasbourg", "Strasbourg", "RC Strasbourg Alsace"],
  [1730, "Toulouse FC", "Toulouse"],
  [1700, "FC Nantes", "Nantes"],
  [1690, "AJ Auxerre", "Auxerre"],
  [1660, "Angers SCO", "Angers"],
  [1660, "Le Havre AC", "Le Havre"],
  [1650, "FC Lorient", "Lorient"],
  [1670, "Paris FC"],
  [1630, "FC Metz", "Metz"],
  // ---------------------------------------------------------------- autres clubs (Ligue des champions)
  [1840, "Benfica", "SL Benfica"],
  [1810, "FC Porto", "Porto"],
  [1850, "Sporting CP", "Sporting Lisbon", "Sporting Portugal", "Sporting"],
  [1820, "PSV Eindhoven", "PSV"],
  [1760, "Ajax", "AFC Ajax", "Ajax Amsterdam"],
  [1780, "Club Bruges", "Club Brugge", "Brugge"],
  [1780, "Galatasaray"],
  [1730, "Celtic", "Celtic FC"],
  // ---------------------------------------------------------------- Afrique (clubs, échelle propre)
  [1700, "Al Ahly", "Al Ahly SC"],
  [1690, "Mamelodi Sundowns"],
  [1640, "Espérance de Tunis", "Esperance de Tunis", "ES Tunis", "Espérance Sportive de Tunis"],
  [1600, "Wydad Casablanca", "Wydad AC", "Wydad"],
  [1660, "Pyramids FC", "Pyramids"],
  [1610, "Zamalek", "Zamalek SC"],
  [1590, "TP Mazembe", "Tout Puissant Mazembe"],
  [1610, "Raja Casablanca", "Raja CA"],
  [1580, "Simba SC", "Simba"],
  [1590, "Young Africans", "Yanga"],
  [1570, "Petro de Luanda", "Petro Atlético", "Atletico Petroleos de Luanda"],
  [1620, "Orlando Pirates"],
  [1580, "MC Alger", "Mouloudia Alger"],
  [1540, "Stade Malien"],
  [1620, "AS FAR", "FAR Rabat"],
  // ---------------------------------------------------------------- Côte d'Ivoire (Ligue 1)
  [1570, "ASEC Mimosas", "ASEC", "ASEC Abidjan"],
  [1470, "Africa Sports", "Africa Sports d'Abidjan"],
  [1490, "Stade d'Abidjan"],
  [1505, "SOA", "Société Omnisports de l'Armée"],
  [1460, "Stella Club d'Adjamé", "Stella Club"],
  [1480, "SC Gagnoa", "Sporting Club de Gagnoa"],
  [1485, "San Pedro FC", "FC San Pedro"],
  [1470, "AFAD Djékanou", "AFAD"],
  [1495, "Racing Club d'Abidjan", "RC Abidjan"],
  [1450, "LYS Sassandra"],
  [1440, "ISCT"],
  [1450, "Mouna FC", "Mouna Akoupé"],
  [1460, "SOL FC"],
  [1450, "Zoman FC"],
  [1430, "FC Ouragahio"],
  [1440, "Bouaké FC"],
];

const NATIONS: Entry[] = [
  // ---------------------------------------------------------------- Afrique
  [1900, "Maroc", "Morocco"],
  [1820, "Sénégal", "Senegal"],
  [1780, "Côte d'Ivoire", "Ivory Coast", "Cote d'Ivoire"],
  [1760, "Égypte", "Egypt"],
  [1760, "Algérie", "Algeria"],
  [1720, "Nigeria"],
  [1700, "Cameroun", "Cameroon"],
  [1700, "Mali"],
  [1700, "RD Congo", "DR Congo", "Congo DR", "République démocratique du Congo"],
  [1680, "Afrique du Sud", "South Africa"],
  [1660, "Tunisie", "Tunisia"],
  [1650, "Burkina Faso"],
  [1630, "Ghana"],
  [1620, "Cap-Vert", "Cape Verde", "Cabo Verde", "Cape Verde Islands"],
  [1600, "Guinée", "Guinea"],
  [1590, "Angola"],
  [1580, "Gabon"],
  [1560, "Zambie", "Zambia"],
  [1560, "Ouganda", "Uganda"],
  [1540, "Bénin", "Benin"],
  [1520, "Guinée équatoriale", "Equatorial Guinea"],
  [1480, "Mauritanie", "Mauritania"],
  [1480, "Togo"],
  [1480, "Mozambique"],
  [1470, "Namibie", "Namibia"],
  [1470, "Madagascar"],
  [1460, "Gambie", "Gambia", "The Gambia"],
  [1450, "Comores", "Comoros"],
  [1430, "Sierra Leone"],
  [1400, "Niger"],
  // ---------------------------------------------------------------- Europe
  [2120, "Espagne", "Spain"],
  [2050, "France"],
  [2020, "Angleterre", "England"],
  [2000, "Portugal"],
  [1960, "Allemagne", "Germany"],
  [1960, "Pays-Bas", "Netherlands", "Holland"],
  [1900, "Italie", "Italy"],
  [1880, "Belgique", "Belgium"],
  [1880, "Croatie", "Croatia"],
  [1840, "Danemark", "Denmark"],
  [1840, "Autriche", "Austria"],
  [1830, "Turquie", "Turkey", "Türkiye"],
  [1820, "Suisse", "Switzerland"],
  [1800, "Norvège", "Norway"],
  [1760, "Ukraine"],
  [1760, "Serbie", "Serbia"],
  [1740, "Pologne", "Poland"],
  [1740, "Écosse", "Scotland"],
  [1730, "Pays de Galles", "Wales"],
  [1720, "Suède", "Sweden"],
];

/** Compétitions entre sélections nationales. */
export const NATIONAL_COMPS = new Set(["can", "wcq-afr", "wcq-eur", "canq"]);

/** Mots ignorés pour comparer des noms d'équipes (formes juridiques, articles…). */
const STOP = new Set(["fc", "cf", "afc", "sc", "ssc", "as", "rc", "cd", "ud", "sd", "ca", "us", "ss", "acf", "vfl", "vfb", "tsg", "fsv", "bc", "sv", "ogc", "losc", "sco", "ac", "club", "de", "d", "the", "and", "calcio", "1", "04", "05", "1899", "1907", "29", "sl", "cp"]);

/** Minuscules, sans accents ni ponctuation. */
export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Forme "squelette" : sans les mots génériques (FC, AS, SC…). */
export function coreName(s: string): string {
  const words = normName(s).split(" ").filter((w) => w && !STOP.has(w));
  return words.length ? words.join(" ") : normName(s);
}

export interface TeamInfo {
  key: string; // nom principal normalisé
  name: string;
  rating: number;
  national: boolean;
}

const INDEX = new Map<string, TeamInfo>(); // nom normalisé -> équipe
const CORE_INDEX = new Map<string, TeamInfo | null>(); // squelette -> équipe (null si ambigu)

function register(list: Entry[], national: boolean) {
  for (const [rating, ...names] of list) {
    const info: TeamInfo = { key: `${national ? "n" : "c"}:${normName(names[0])}`, name: names[0], rating, national };
    for (const n of names) {
      INDEX.set(`${national ? "n" : "c"}|${normName(n)}`, info);
      const c = `${national ? "n" : "c"}|${coreName(n)}`;
      const prev = CORE_INDEX.get(c);
      CORE_INDEX.set(c, prev === undefined || prev?.key === info.key ? info : null);
    }
  }
}
register(CLUBS, false);
register(NATIONS, true);

/** Retrouve une équipe connue (nom français ou anglais, avec ou sans « FC », accents…). */
export function findTeam(name: string, national: boolean): TeamInfo | null {
  const p = national ? "n" : "c";
  return INDEX.get(`${p}|${normName(name)}`) ?? CORE_INDEX.get(`${p}|${coreName(name)}`) ?? null;
}

/** Clé de comparaison d'une équipe : identifiant de la base si elle est connue, sinon son squelette. */
export function teamKey(name: string, national: boolean): string {
  return findTeam(name, national)?.key ?? `?:${coreName(name)}`;
}

/** Deux noms désignent-ils la même équipe ? (alias connus, puis squelettes égaux ou inclus). */
export function sameTeam(a: string, b: string, national: boolean): boolean {
  const ka = teamKey(a, national);
  const kb = teamKey(b, national);
  if (ka === kb) return true;
  if (!ka.startsWith("?:") && !kb.startsWith("?:")) return false; // deux équipes connues et différentes
  const ca = coreName(a);
  const cb = coreName(b);
  if (ca === cb) return true;
  const [short, long] = ca.length <= cb.length ? [ca, cb] : [cb, ca];
  return short.length >= 6 && (` ${long} `).includes(` ${short} `);
}

/** Note par défaut d'une équipe inconnue, selon la compétition. */
export const DEFAULT_RATING: Record<string, number> = {
  epl: 1720, laliga: 1700, seriea: 1690, bundesliga: 1700, ligue1: 1670, ucl: 1760,
  can: 1520, cafcl: 1560, "ci-ligue1": 1450, "wcq-afr": 1520, "wcq-eur": 1650, canq: 1480,
};

export function teamRating(name: string, competitionId: string): { rating: number; known: boolean } {
  const t = findTeam(name, NATIONAL_COMPS.has(competitionId));
  return t ? { rating: t.rating, known: true } : { rating: DEFAULT_RATING[competitionId] ?? 1600, known: false };
}
