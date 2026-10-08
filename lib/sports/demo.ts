// Fournisseur de DÉMONSTRATION : génère des matchs réalistes (vrais noms d'équipes) autour de la date du jour.
// Les rencontres, horaires et scores sont FICTIFS. Ils sont déterministes : le même jour donne toujours les mêmes
// matchs. Après le coup d'envoi, le match est simulé « en direct » (minute, 1re MT, mi-temps de 15 min, 2e MT,
// temps additionnel, buts et cartons rouges qui tombent au fil du temps) ; le score final est celui de la simulation,
// publié au coup de sifflet final (~1 h 50 après le coup d'envoi), ce qui déclenche le règlement automatique des paris.
// ~4 % des matchs sont « reportés » au coup d'envoi. L'admin peut aussi fixer lui-même le score.
import type { LiveInfo, MatchEvent, MatchPeriod, MatchStatus } from "../types";
import type { FixtureData, SportsProvider } from "./types";

const NATIONS_AFR = [
  "Côte d'Ivoire", "Sénégal", "Maroc", "Nigeria", "Égypte", "Cameroun", "Algérie", "Ghana", "Mali", "Tunisie",
  "Afrique du Sud", "RD Congo", "Burkina Faso", "Guinée", "Cap-Vert", "Gabon", "Zambie", "Angola", "Bénin", "Ouganda",
];

const TEAMS: Record<string, string[]> = {
  epl: ["Arsenal", "Manchester City", "Liverpool", "Chelsea", "Manchester United", "Tottenham", "Newcastle", "Aston Villa", "Brighton", "West Ham", "Crystal Palace", "Brentford", "Fulham", "Everton", "Nottingham Forest", "Bournemouth", "Wolverhampton", "Leeds United", "Burnley", "Sunderland"],
  laliga: ["Real Madrid", "FC Barcelone", "Atlético Madrid", "Athletic Bilbao", "Real Sociedad", "Villarreal", "Betis Séville", "FC Séville", "Valence", "Girona", "Celta Vigo", "Osasuna", "Getafe", "Majorque", "Rayo Vallecano", "Alavés", "Espanyol", "Levante", "Elche", "Real Oviedo"],
  seriea: ["Inter Milan", "AC Milan", "Juventus", "Naples", "AS Rome", "Lazio", "Atalanta", "Fiorentina", "Bologne", "Torino", "Udinese", "Genoa", "Côme", "Cagliari", "Lecce", "Parme", "Hellas Vérone", "Sassuolo", "Pise", "Cremonese"],
  bundesliga: ["Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig", "Eintracht Francfort", "VfB Stuttgart", "Wolfsburg", "Fribourg", "Mayence", "Mönchengladbach", "Werder Brême", "Union Berlin", "Augsbourg", "Hoffenheim", "Heidenheim", "St. Pauli", "Cologne", "Hambourg SV"],
  ligue1: ["Paris Saint-Germain", "Olympique de Marseille", "AS Monaco", "LOSC Lille", "OGC Nice", "Olympique Lyonnais", "RC Lens", "Stade Rennais", "Stade Brestois", "RC Strasbourg", "Toulouse FC", "FC Nantes", "AJ Auxerre", "Angers SCO", "Le Havre AC", "FC Lorient", "Paris FC", "FC Metz"],
  ucl: ["Real Madrid", "FC Barcelone", "Bayern Munich", "Paris Saint-Germain", "Manchester City", "Liverpool", "Arsenal", "Inter Milan", "Juventus", "Borussia Dortmund", "Atlético Madrid", "Chelsea", "Benfica", "FC Porto", "Sporting CP", "PSV Eindhoven", "Ajax", "Club Bruges", "Galatasaray", "Naples", "Bayer Leverkusen", "AS Monaco", "Celtic", "Olympique de Marseille"],
  can: NATIONS_AFR,
  cafcl: ["Al Ahly", "Mamelodi Sundowns", "Espérance de Tunis", "Wydad Casablanca", "Pyramids FC", "Zamalek", "ASEC Mimosas", "TP Mazembe", "Raja Casablanca", "Simba SC", "Young Africans", "Petro de Luanda", "Orlando Pirates", "MC Alger", "Stade Malien", "AS FAR"],
  "ci-ligue1": ["ASEC Mimosas", "Africa Sports", "Stade d'Abidjan", "SOA", "Stella Club d'Adjamé", "SC Gagnoa", "San Pedro FC", "AFAD Djékanou", "Racing Club d'Abidjan", "LYS Sassandra", "ISCT", "Mouna FC", "SOL FC", "Zoman FC", "FC Ouragahio", "Bouaké FC"],
  "wcq-afr": NATIONS_AFR,
  "wcq-eur": ["France", "Angleterre", "Espagne", "Allemagne", "Portugal", "Italie", "Pays-Bas", "Belgique", "Croatie", "Suisse", "Danemark", "Autriche", "Pologne", "Ukraine", "Suède", "Norvège", "Serbie", "Turquie", "Écosse", "Pays de Galles"],
  canq: [...NATIONS_AFR, "Comores", "Mauritanie", "Namibie", "Togo", "Niger", "Madagascar", "Sierra Leone", "Gambie", "Guinée équatoriale", "Mozambique"],
};

// Jour de la semaine (0 = dimanche) -> horaires (UTC = heure d'Abidjan) des matchs de la journée
const SCHEDULE: Record<string, Record<number, string[]>> = {
  epl: { 6: ["11:30", "14:00", "14:00", "16:30"], 0: ["13:00", "15:30"], 1: ["19:00"] },
  laliga: { 5: ["19:00"], 6: ["12:00", "14:15", "16:30", "19:00"], 0: ["14:00", "19:00"] },
  seriea: { 6: ["13:00", "16:00", "18:45"], 0: ["10:30", "13:00", "16:00", "18:45"] },
  bundesliga: { 5: ["18:30"], 6: ["13:30", "13:30", "16:30"], 0: ["13:30", "15:30"] },
  ligue1: { 5: ["18:45"], 6: ["15:00", "17:00", "19:05"], 0: ["13:00", "15:15", "18:45"] },
  ucl: { 2: ["16:45", "19:00", "19:00", "19:00"], 3: ["16:45", "19:00", "19:00", "19:00"] },
  can: { 3: ["16:00", "19:00"], 6: ["16:00", "19:00"] },
  cafcl: { 5: ["17:00"], 6: ["14:00", "17:00"], 0: ["16:00"] },
  "ci-ligue1": { 6: ["15:30", "15:30", "16:00"], 0: ["15:30", "16:00"] },
  "wcq-afr": { 4: ["16:00", "19:00"] },
  "wcq-eur": { 4: ["18:45"], 5: ["18:45", "18:45"] },
  canq: { 1: ["16:00", "19:00"], 2: ["16:00"] },
};

const VENUE_ROUND: Record<string, string> = {
  epl: "Journée", laliga: "Jornada", seriea: "Giornata", bundesliga: "Spieltag", ligue1: "Journée", ucl: "Phase de ligue",
  can: "Phase de groupes", cafcl: "Phase de groupes", "ci-ligue1": "Journée", "wcq-afr": "Groupe", "wcq-eur": "Groupe", canq: "Groupe",
};

const CUP_COMPS = new Set(["ucl", "can", "cafcl", "wcq-afr", "wcq-eur", "canq"]);

/** Générateur pseudo-aléatoire déterministe (mulberry32) initialisé par une chaîne. */
function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function goals(r: () => number, strength: number) {
  const x = r() + strength;
  if (x < 0.27) return 0;
  if (x < 0.62) return 1;
  if (x < 0.85) return 2;
  if (x < 0.95) return 3;
  return 4;
}

// Noms de joueurs FICTIFS pour les buteurs de la démo.
const SURNAMES = [
  "Koné", "Traoré", "Diallo", "Bamba", "Kouassi", "Touré", "Cissé", "Sangaré", "Yao", "Konaté", "Fofana", "Diabaté", "Ndiaye", "Mensah",
  "Okafor", "Benali", "Haddad", "Mbemba", "Sylla", "Camara", "Martin", "Bernard", "Silva", "Santos", "Moreno", "Rossi", "Ricci",
  "Müller", "Schmidt", "Weber", "Jansen", "De Vries", "Novak", "Kovač", "Smith", "Walker", "Hughes", "Costa", "Ferreira", "Lopez",
];
const INITIALS = "ABCDEFGHIJKLMNOPRSTWY";

/** Effectif fictif (déterministe) d'une équipe : 11 noms. */
function squad(team: string): string[] {
  const r = rng(`squad|${team}`);
  const out: string[] = [];
  while (out.length < 11) {
    const n = `${INITIALS[Math.floor(r() * INITIALS.length)]}. ${SURNAMES[Math.floor(r() * SURNAMES.length)]}`;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

const HALF = 45;
const BREAK = 15; // mi-temps (minutes réelles)

interface SimEvent extends MatchEvent {
  /** Minutes réelles écoulées depuis le coup d'envoi au moment du fait de jeu. */
  at: number;
  half: 1 | 2;
}

/** Chronologie complète (déterministe) d'un match dont le score final est connu. */
function simulate(seed: string, home: string, away: string, final: { home: number; away: number }) {
  const r = rng(`${seed}|live`);
  const add1 = 1 + Math.floor(r() * 4); // temps additionnel 1re MT : 1 à 4 min
  const add2 = 2 + Math.floor(r() * 5); // 2e MT : 2 à 6 min
  const start2 = HALF + add1 + BREAK;
  const end = start2 + HALF + add2;
  const events: SimEvent[] = [];
  const at = (half: 1 | 2, x: number) => (half === 1 ? x - 1 : start2 + (x - 46)); // x = minute « horloge » (1..45+add1 ou 46..90+add2)
  const mk = (half: 1 | 2, x: number) => {
    const cap = half === 1 ? HALF : 90;
    return { minute: Math.min(x, cap), extra: x > cap ? x - cap : null, at: at(half, x), half };
  };
  const players = { home: squad(home), away: squad(away) };
  for (const side of ["home", "away"] as const) {
    for (let g = 0; g < final[side]; g++) {
      const half: 1 | 2 = r() < 0.44 ? 1 : 2;
      const x = half === 1 ? 1 + Math.floor(r() * (HALF + add1)) : 46 + Math.floor(r() * (HALF + add2));
      const k = r();
      const type = k < 0.06 ? "own-goal" : k < 0.16 ? "penalty" : "goal";
      const other = side === "home" ? "away" : "home";
      const scorer = type === "own-goal" ? players[other][1 + Math.floor(r() * 4)] : players[side][5 + Math.floor(r() * 6)];
      let assist: string | undefined = type === "goal" && r() < 0.7 ? players[side][2 + Math.floor(r() * 9)] : undefined;
      if (assist === scorer) assist = undefined;
      events.push({ ...mk(half, x), team: side, type, player: scorer, assist });
    }
  }
  if (r() < 0.16) {
    const side = r() < 0.5 ? "home" : "away";
    const half: 1 | 2 = r() < 0.3 ? 1 : 2;
    const x = half === 1 ? 20 + Math.floor(r() * 25) : 50 + Math.floor(r() * 40);
    events.push({ ...mk(half, x), team: side, type: "red-card", player: players[side][1 + Math.floor(r() * 7)] });
  }
  events.sort((a, b) => a.at - b.at);
  return { add1, add2, start2, end, events };
}

type Sim = ReturnType<typeof simulate>;

/** État « en direct » du match t minutes réelles après le coup d'envoi. */
function liveAt(sim: Sim, t: number, nowIso: string): LiveInfo {
  let period: MatchPeriod;
  let elapsed: number;
  let extra: number | null = null;
  if (t >= sim.end) {
    period = "FT";
    elapsed = 90;
  } else if (t < HALF + sim.add1) {
    period = "1H";
    const m = Math.floor(t) + 1;
    elapsed = Math.min(m, HALF);
    if (m > HALF) extra = m - HALF;
  } else if (t < sim.start2) {
    period = "HT";
    elapsed = HALF;
  } else {
    period = "2H";
    const m = Math.floor(t - sim.start2) + 46;
    elapsed = Math.min(m, 90);
    if (m > 90) extra = m - 90;
  }
  const seen = sim.events.filter((e) => e.at <= t);
  const goals = { home: 0, away: 0 };
  const halftime = { home: 0, away: 0 };
  for (const e of seen) {
    if (e.type === "red-card") continue;
    goals[e.team]++;
    if (e.half === 1) halftime[e.team]++;
  }
  return {
    period,
    elapsed,
    extra,
    goals,
    halftime: period === "1H" ? null : halftime,
    events: seen.map(({ minute, extra: x, team, type, player, assist }) => ({ minute, extra: x, team, type, player, ...(assist ? { assist } : {}) })),
    updatedAt: nowIso,
  };
}

function generate(from: Date, to: Date, now: number): FixtureData[] {
  const out: FixtureData[] = [];
  const day = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (; day <= to; day.setUTCDate(day.getUTCDate() + 1)) {
    const dateKey = day.toISOString().slice(0, 10);
    const dow = day.getUTCDay();
    for (const [compId, byDay] of Object.entries(SCHEDULE)) {
      const times = byDay[dow];
      if (!times) continue;
      const r = rng(`${compId}|${dateKey}`);
      const teams = [...TEAMS[compId]];
      for (let i = teams.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [teams[i], teams[j]] = [teams[j], teams[i]];
      }
      // numéro de journée approximatif (une journée par semaine depuis mi-août)
      const week = Math.max(1, Math.floor((day.getTime() - Date.UTC(day.getUTCFullYear(), 7, 15)) / (7 * 86400000)) + 1);
      times.forEach((time, i) => {
        const [hh, mm] = time.split(":").map(Number);
        const kickoff = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh, mm));
        const home = teams[2 * i];
        const away = teams[2 * i + 1];
        const t = kickoff.getTime();
        const mr = rng(`${compId}|${dateKey}|${i}|score`);
        let status: MatchStatus = "scheduled";
        let score: FixtureData["score"] = null;
        let live: LiveInfo | undefined;
        if (now >= t) {
          if (mr() < 0.04) status = "postponed";
          else {
            // mêmes tirages qu'avant : le score final ne dépend que du match, pas de l'heure
            const final = { home: goals(mr, 0.05), away: goals(mr, -0.03) };
            const sim = simulate(`${compId}|${dateKey}|${i}`, home, away, final);
            const elapsedMin = (now - t) / 60000;
            live = liveAt(sim, elapsedMin, new Date(now).toISOString());
            if (elapsedMin >= sim.end) {
              status = "finished";
              score = final;
            } else status = "live";
          }
        }
        out.push({
          externalId: `${compId}:${dateKey}:${i}`,
          competitionId: compId,
          home,
          away,
          kickoff: kickoff.toISOString(),
          status,
          score,
          live,
          round: `${VENUE_ROUND[compId]} ${CUP_COMPS.has(compId) ? (week % 6) + 1 : week}`,
          venue: `Stade – ${home}`,
        });
      });
    }
  }
  return out;
}

export const demoProvider: SportsProvider = {
  id: "demo",
  label: "Données de démonstration (matchs fictifs)",
  isDemo: true,
  syncIntervalMs: 60 * 1000,
  async fetchFixtures(from, to) {
    return generate(from, to, Date.now());
  },
};
