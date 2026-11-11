// Stockage local très simple : un fichier JSON (data/db.json) dans le dossier du projet.
// Toutes les opérations sont synchrones : une "transaction" lit le fichier, applique
// les modifications en mémoire puis réécrit le fichier de façon atomique (fichier temporaire + rename).
// Comme Node.js est mono-thread, deux transactions ne peuvent pas s'entremêler dans le même processus.
// Le dossier peut être changé avec la variable d'environnement FARIMA_DATA_DIR (utile pour les tests).
import fs from "node:fs";
import path from "node:path";
import type {
  Currency,
  GameCurrency,
  GameId,
  Level,
  MobileOperator,
  Mode,
  PaymentKind,
  PaymentStatus,
  Role,
  TableStatus,
} from "../types";

export interface UserRow {
  id: string;
  username: string;
  usernameLower: string;
  /** Identifiant du compte Clerk lié (« user_… ») ; « test:… » pour les comptes des tests automatiques. */
  clerkId?: string;
  /** E-mail principal du compte Clerk au moment de la création (sert à ADMIN_EMAILS). */
  email?: string;
  /** Anciens comptes à mot de passe (avant Clerk) : conservés dans la base mais ne peuvent plus se connecter. */
  passwordHash?: string;
  salt?: string;
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

export type InviteStatus = "pending" | "accepted" | "declined";

export interface TableInvite {
  userId: string;
  username: string;
  status: InviteStatus;
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
  /** Joueurs invités pour une partie à 2, 3 ou 4. Vide pour l'ordinateur et les anciennes tables ouvertes. */
  invites?: TableInvite[];
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

export interface StaffInvite {
  id: string;
  email: string;
  role: "MANAGER" | "HOME";
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
  createdBy: string;
  clerkInvitationId?: string;
  acceptedAt?: string;
  userId?: string;
}

export interface Db {
  users: UserRow[];
  sessions: SessionRow[];
  transactions: TxRow[];
  staffInvites: StaffInvite[];
  house: { coris: number; lions: number; fcfa: number; ledger: HouseTxRow[] };
  tables: TableRow[];
  payments: PaymentRow[];
}

const DATA_DIR = process.env.FARIMA_DATA_DIR ? path.resolve(process.env.FARIMA_DATA_DIR) : path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function emptyDb(): Db {
  return {
    users: [],
    sessions: [],
    transactions: [],
    staffInvites: [],
    house: { coris: 0, lions: 0, fcfa: 0, ledger: [] },
    tables: [],
    payments: [],
  };
}

/** Met à niveau une base créée par une version précédente (champs ajoutés depuis). */
function normalize(db: Db): Db {
  db.house = { ...emptyDb().house, ...db.house };
  db.house.fcfa ??= 0;
  db.staffInvites ??= [];
  for (const u of db.users) {
    u.fcfa ??= 0;
    if (u.role !== "ADMIN" && u.role !== "HOME" && u.role !== "MANAGER") u.role = "JOUEUR";
  }
  for (const t of db.tables) t.invites ??= [];
  const legacy = db as Db & { matches?: unknown; bets?: unknown; sports?: unknown; oddsApi?: unknown };
  delete legacy.matches;
  delete legacy.bets;
  delete legacy.sports;
  delete legacy.oddsApi;
  // Le premier administrateur est désigné à la création du compte (voir provisionUser dans wallet.ts).
  return db;
}

function readDbFile(): Db {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return normalize({ ...emptyDb(), ...(JSON.parse(raw) as Db) });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyDb();
    throw e;
  }
}

function writeDbFile(db: Db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

// Sur Vercel le dossier du projet est en lecture seule (/var/task). La base JSON
// est alors un document dans Neon, pour que l'inscription et les parties survivent.
const USE_POSTGRES = process.env.VERCEL === "1";

let postgresReady: Promise<void> | null = null;

async function postgres() {
  const { prisma } = await import("./prisma");
  postgresReady ??= prisma
    .$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS app_documents (
        id TEXT PRIMARY KEY,
        body JSONB NOT NULL
      )`,
    )
    .then(() => undefined);
  await postgresReady;
  return prisma;
}

async function readDbPostgres(): Promise<Db> {
  const prisma = await postgres();
  const rows = await prisma.$queryRawUnsafe<Array<{ body: Db | string }>>(
    `SELECT body FROM app_documents WHERE id = 'db'`,
  );
  if (!rows.length) return emptyDb();
  const body = rows[0].body;
  const parsed = typeof body === "string" ? (JSON.parse(body) as Db) : body;
  return normalize({ ...emptyDb(), ...parsed });
}

async function writeDbPostgres(db: Db) {
  const prisma = await postgres();
  await prisma.$executeRaw`INSERT INTO app_documents (id, body) VALUES ('db', ${JSON.stringify(db)}::jsonb) ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body`;
}

export async function readDb(): Promise<Db> {
  return USE_POSTGRES ? readDbPostgres() : readDbFile();
}

async function writeDb(db: Db) {
  if (USE_POSTGRES) await writeDbPostgres(db);
  else writeDbFile(db);
}

/** Exécute fn sur la base ; écrit seulement si fn ne lève pas d'erreur. */
export async function transact<T>(fn: (db: Db) => T): Promise<T> {
  const db = await readDb();
  const result = fn(db);
  await writeDb(db);
  return result;
}

export function newId(prefix = ""): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const nowIso = () => new Date().toISOString();
