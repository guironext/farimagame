export type Currency = "coris" | "lions" | "fcfa";
/** Monnaies utilisables aux tables de jeu. */
export type GameCurrency = "coris" | "lions";
export type GameId = "ludo" | "dames" | "awale" | "echecs";
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
