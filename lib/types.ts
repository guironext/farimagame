export type Currency = "coris" | "lions" | "fcfa";
/** Monnaies utilisables aux tables de jeu. */
export type GameCurrency = "coris" | "lions";
export type GameId = "ludo" | "dames" | "awale" | "echecs" | "run" | "course";
export type Mode = "cpu" | "2" | "3" | "4";
export type Level = "normal" | "pro";
export type Role = "JOUEUR" | "MANAGER" | "ADMIN" | "HOME";

export const ROLE_LABEL: Record<Role, string> = {
  JOUEUR: "Joueur",
  MANAGER: "Manager",
  ADMIN: "Administrateur",
  HOME: "Maison",
};

/** Caisse, commissions, dépôts, retraits et règlement des mises. */
export const canManageMoney = (role: Role) => role === "HOME" || role === "ADMIN";

export interface PublicUser {
  id: string;
  username: string;
  role: Role;
  level: Level;
  coris: number; // en unités humaines
  lions: number;
  fcfa: number; // francs CFA
  createdAt: string;
}

export interface TxView {
  id: string;
  type: string;
  label: string;
  currency: Currency;
  amount: number;
  balanceAfter: number;
  tableId?: string;
  matchId?: string;
  createdAt: string;
}
export interface SeatView {
  seat: number;
  userId: string | null; // null = ordinateur
  username: string;
  isCpu: boolean;
  active: boolean; // false si abandon
}

export type TableStatus = "waiting" | "playing" | "finished" | "cancelled";
export type InviteStatus = "pending" | "accepted" | "declined";

export interface TableInviteView {
  userId: string;
  username: string;
  status: InviteStatus;
}

export interface TableView {
  id: string;
  game: GameId;
  mode: Mode;
  currency: GameCurrency;
  stake: number;
  maxPlayers: number;
  status: TableStatus;
  seats: SeatView[];
  invites: TableInviteView[];
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastMoveAt?: string;
  currentSeat: number | null;
  winnerSeat: number | null;
  isDraw: boolean;
  pot: number;
  payout: number; // gain versé au gagnant (ou à chacun en cas de nul)
  commission: number;
  state: unknown;
  log: string[];
  mySeat: number | null;
  version: number;
}

// ------------------------------- Paris sportifs -------------------------------
export type CompetitionGroup = "europe" | "ldc" | "afrique" | "eliminatoires";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";
export type MarketId = "1N2" | "BTTS" | "OU25";
/** Statut détaillé (codes API-Football : 1H, HT, 2H, ET, BT, P, SUSP, INT, LIVE, FT, AET, PEN, PST, CANC, ABD, AWD, WO, NS, TBD). */
export type MatchPeriod =
  | "NS" | "TBD" | "1H" | "HT" | "2H" | "ET" | "BT" | "P" | "SUSP" | "INT" | "LIVE"
  | "FT" | "AET" | "PEN" | "PST" | "CANC" | "ABD" | "AWD" | "WO";

export type MatchEventType = "goal" | "own-goal" | "penalty" | "missed-penalty" | "red-card" | "yellow-card";

/** Fait de match (but, carton…). `team` = équipe concernée (pour un but contre son camp : l'équipe qui en profite). */
export interface MatchEvent {
  minute: number;
  extra?: number | null;
  team: "home" | "away";
  type: MatchEventType;
  player?: string;
  assist?: string;
}

export interface ScorePair {
  home: number;
  away: number;
}

/** Informations « en direct » d'un match (score courant, minute, période, buteurs…). */
export interface LiveInfo {
  period: MatchPeriod;
  /** Minute écoulée (ex. 67), null avant le coup d'envoi. */
  elapsed: number | null;
  /** Temps additionnel en cours (ex. 2 pour 45+2'). */
  extra: number | null;
  /** Score courant (prolongation comprise). */
  goals: ScorePair | null;
  halftime: ScorePair | null;
  /** Score après prolongation / tirs au but quand il y en a. */
  extratime?: ScorePair | null;
  penalties?: ScorePair | null;
  events: MatchEvent[];
  /** Date de la dernière mise à jour reçue de la source. */
  updatedAt: string;
}

export type Selection = "1" | "N" | "2" | "oui" | "non" | "plus" | "moins";
export type BetStatus = "pending" | "won" | "lost" | "refunded";

export interface CompetitionView {
  id: string;
  name: string;
  short: string;
  group: CompetitionGroup;
  country: string;
  flag: string;
}

export interface OutcomePool {
  selection: Selection;
  label: string;
  total: number; // F CFA misés sur cette issue
  bets: number;
  /** Cote affichée (toujours un nombre) : mélange cote de référence / cote du pot, voir blendedOdds (lib/betting.ts). */
  odds: number;
  /** Probabilité de référence sans marge (bookmakers ou modèle FarimaGame). */
  refProb: number;
  /** Cote de référence seule (marge de la maison incluse). */
  refOdds: number;
  /** Cote du pot seul (pot × 90 % ÷ mises sur l'issue), null si personne n'a misé contre cette issue. */
  poolOdds: number | null;
}

export type OddsSource = "bookmakers" | "farimagame";

export interface MarketPool {
  market: MarketId;
  label: string;
  total: number;
  outcomes: OutcomePool[];
  /** Issue gagnante une fois le match réglé. */
  winner?: Selection | null;
  /** Origine de la cote de référence de ce marché. */
  refSource: "bookmakers" | "modele";
  /** Poids du pot dans la cote affichée (0 à 1). */
  blendWeight: number;
  /** Constante K du mélange (F CFA). */
  blendK: number;
}

export interface MatchView {
  id: string;
  competitionId: string;
  competition: CompetitionView;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  kickoff: string;
  status: MatchStatus;
  /** Score à 90 min (sert au règlement des paris). */
  score: { home: number; away: number } | null;
  /** Score en direct, minute, période, buteurs… (null si la source n'en fournit pas). */
  live: LiveInfo | null;
  round?: string;
  venue?: string;
  source: "demo" | "api-football" | "manuel";
  bettingOpen: boolean;
  settled: boolean;
  totalPool: number;
  markets: MarketPool[];
  /** Origine des cotes de référence du match. */
  odds: { source: OddsSource; books?: number; updatedAt?: string };
}

export interface BetView {
  id: string;
  matchId: string;
  match: { home: string; away: string; kickoff: string; status: MatchStatus; score: { home: number; away: number } | null; competition: string };
  market: MarketId;
  marketLabel: string;
  selection: Selection;
  selectionLabel: string;
  stake: number;
  status: BetStatus;
  payout: number;
  estimatedPayout: number | null;
  note?: string;
  createdAt: string;
  settledAt?: string;
}

export type PaymentKind = "depot" | "retrait";
export type PaymentStatus = "pending" | "completed" | "failed" | "rejected";
export type MobileOperator = "orange" | "mtn" | "wave" | "moov";

export interface PaymentView {
  id: string;
  kind: PaymentKind;
  operator: MobileOperator;
  phone: string;
  amount: number;
  status: PaymentStatus;
  provider: string;
  providerRef?: string;
  message?: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
}
