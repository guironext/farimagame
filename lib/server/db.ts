// Stockage local très simple : un fichier JSON (data/db.json) dans le dossier du projet.
// Toutes les opérations sont synchrones : une "transaction" lit le fichier, applique
// les modifications en mémoire puis réécrit le fichier de façon atomique (fichier temporaire + rename).
// Comme Node.js est mono-thread, deux transactions ne peuvent pas s'entremêler dans le même processus.
// Le dossier peut être changé avec la variable d'environnement FARIMA_DATA_DIR (utile pour les tests).
import fs from "node:fs";
import path from "node:path";
import type {
  BetStatus,
  Currency,
  GameCurrency,
  GameId,
  Level,
  LiveInfo,
  MarketId,
  MatchStatus,
  MobileOperator,
  Mode,
  PaymentKind,
  PaymentStatus,
  Role,
  Selection,
  TableStatus,
} from "../types";
import type { OddsCache } from "./odds";

export interface UserRow {
  id: string;
  username: string;
  usernameLower: string;
  passwordHash: string;
  salt: string;
  role: Role;
  level: Level;
  coris: number; // centièmes
  lions: number; // centièmes
  fcfa: number; // centièmes de franc (toujours un multiple de 100 : francs entiers)
  createdAt: string;
  proSince?: string;
}

export interface SessionRow {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface TxRow {
  id: string;
  userId: string;
  type:
    | "bonus"
    | "mise"
    | "gain"
    | "nul"
    | "remboursement"
    | "conversion_debit"
    | "conversion_credit"
    | "depot"
    | "retrait"
    | "retrait_annule"
    | "pari"
    | "gain_pari"
    | "remboursement_pari";
  currency: Currency;
  amount: number; // centièmes, signé
  balanceAfter: number;
  tableId?: string;
  matchId?: string;
  paymentId?: string;
  label: string;
  createdAt: string;
}

export interface HouseTxRow {
  id: string;
  type:
    | "commission"
    | "mise_ordinateur"
    | "gain_ordinateur"
    | "nul_ordinateur"
    | "remboursement_ordinateur"
    | "commission_pari"
    | "arrondi_pari";
  currency: Currency;
  amount: number; // centièmes, signé
  tableId?: string;
  matchId?: string;
  label: string;
  createdAt: string;
}

export interface SeatRow {
  seat: number;
  userId: string | null;
  username: string;
  isCpu: boolean;
  active: boolean;
}

export interface TableRow {
  id: string;
  game: GameId;
  mode: Mode;
  currency: GameCurrency;
  stake: number; // centièmes
  maxPlayers: number;
  status: TableStatus;
  seats: SeatRow[];
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastMoveAt?: string;
  winnerSeat: number | null;
  isDraw: boolean;
  pot: number;
  payout: number;
  commission: number;
  state: unknown;
  log: string[];
  version: number;
}

/** Match de football (copie locale des données du fournisseur, ou corrigée par l'admin). */
export interface MatchRow {
  id: string; // ex. "demo:epl:2026-10-10:0" ou "af:1234567"
  source: "demo" | "api-football" | "manuel";
  competitionId: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  kickoff: string; // ISO
  status: MatchStatus;
  score: { home: number; away: number } | null;
  /** Score en direct, minute, période, buteurs (affichage uniquement ; le règlement utilise score). */
  live?: LiveInfo;
  round?: string;
  venue?: string;
  /** true si l'admin a fixé le résultat / statut : la synchronisation ne l'écrase plus. */
  manual?: boolean;
  settledAt?: string;
  /** Résultat du règlement par marché. */
  settlement?: Partial<Record<MarketId, { winner: Selection | null; pool: number; commission: number; refunded: boolean; reason?: string }>>;
  updatedAt: string;
}

export interface BetRow {
  id: string;
  userId: string;
  matchId: string;
  market: MarketId;
  selection: Selection;
  stake: number; // centièmes de F CFA
  status: BetStatus;
  payout: number; // centièmes (versé au règlement)
  note?: string;
  createdAt: string;
  settledAt?: string;
}

export interface PaymentRow {
  id: string;
  userId: string;
  kind: PaymentKind;
  operator: MobileOperator;
  phone: string;
  amount: number; // centièmes de F CFA
  status: PaymentStatus;
  provider: string;
  providerRef?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Db {
  users: UserRow[];
  sessions: SessionRow[];
  transactions: TxRow[];
  house: { coris: number; lions: number; fcfa: number; ledger: HouseTxRow[] };
  tables: TableRow[];
  matches: MatchRow[];
  bets: BetRow[];
  payments: PaymentRow[];
  sports: {
    provider?: string;
    lastSyncAt?: string;
    lastError?: string;
    /** Dernier rafraîchissement « en direct » (API-Football /fixtures?ids=…). */
    lastLiveAt?: string;
    lastLiveError?: string;
    /** Suivi du quota quotidien API-Football (remis à zéro chaque jour à 00:00 UTC). */
    quota?: { day: string; used: number; remaining?: number | null; limit?: number | null };
  };
  /** Cache des cotes bookmakers (The Odds API). */
  oddsApi?: OddsCache;
}

const DATA_DIR = process.env.FARIMA_DATA_DIR ? path.resolve(process.env.FARIMA_DATA_DIR) : path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function emptyDb(): Db {
  return {
    users: [],
    sessions: [],
    transactions: [],
    house: { coris: 0, lions: 0, fcfa: 0, ledger: [] },
    tables: [],
    matches: [],
    bets: [],
    payments: [],
    sports: {},
  };
}

/** Met à niveau une base créée par une version précédente (champs ajoutés depuis). */
function normalize(db: Db): Db {
  db.house = { ...emptyDb().house, ...db.house };
  db.house.fcfa ??= 0;
  for (const u of db.users) {
    u.fcfa ??= 0;
    if (u.role !== "ADMIN") u.role = "JOUEUR";
  }
  // Le premier compte créé devient administrateur s'il n'y en a encore aucun.
  if (db.users.length > 0 && !db.users.some((u) => u.role === "ADMIN")) db.users[0].role = "ADMIN";
  return db;
}

export function readDb(): Db {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return normalize({ ...emptyDb(), ...(JSON.parse(raw) as Db) });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyDb();
    throw e;
  }
}

function writeDb(db: Db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

/** Exécute fn sur la base ; écrit seulement si fn ne lève pas d'erreur. */
export function transact<T>(fn: (db: Db) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export function newId(prefix = ""): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const nowIso = () => new Date().toISOString();
