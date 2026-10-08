import { CORIS_PER_LION, FCFA_PER_LION, SIGNUP_BONUS_CORIS, toUnits } from "../config";
import type { Currency } from "../types";
import { hashPassword, newSessionToken, SESSION_DAYS, verifyPassword } from "./auth";
import { newId, nowIso, transact, type Db, type HouseTxRow, type TxRow, type UserRow } from "./db";
import { AppError } from "./errors";

export const CURRENCY_LABEL: Record<Currency, string> = { coris: "Coris", lions: "Lions", fcfa: "F CFA" };

export function getUser(db: Db, userId: string): UserRow {
  const u = db.users.find((x) => x.id === userId);
  if (!u) throw new AppError(401, "Compte introuvable.");
  return u;
}

/** Mouvement sur le portefeuille d'un joueur (montant signé, en centièmes). */
export function walletMove(
  db: Db,
  user: UserRow,
  currency: Currency,
  amount: number,
  type: TxRow["type"],
  label: string,
  tableId?: string,
  extra?: { matchId?: string; paymentId?: string },
) {
  if (!Number.isInteger(amount)) throw new AppError(500, "Montant invalide.");
  if (user[currency] + amount < 0) {
    throw new AppError(400, `Solde insuffisant en ${CURRENCY_LABEL[currency]}.`);
  }
  user[currency] += amount;
  db.transactions.push({
    id: newId("tx_"),
    userId: user.id,
    type,
    currency,
    amount,
    balanceAfter: user[currency],
    tableId,
    ...extra,
    label,
    createdAt: nowIso(),
  });
}

/** Mouvement sur la caisse de la maison. */
export function houseMove(
  db: Db,
  currency: Currency,
  amount: number,
  type: HouseTxRow["type"],
  label: string,
  tableId?: string,
  matchId?: string,
) {
  db.house[currency] = (db.house[currency] ?? 0) + amount;
  db.house.ledger.push({ id: newId("h_"), type, currency, amount, tableId, matchId, label, createdAt: nowIso() });
}

function createSession(db: Db, userId: string) {
  const token = newSessionToken();
  const now = new Date();
  db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > now.getTime());
  db.sessions.push({
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString(),
  });
  return token;
}

export function register(usernameRaw: unknown, passwordRaw: unknown) {
  const username = String(usernameRaw ?? "").trim();
  const password = String(passwordRaw ?? "");
  if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username))
    throw new AppError(400, "Le pseudo doit faire 3 à 20 caractères (lettres, chiffres, _ . -).");
  if (password.length < 6) throw new AppError(400, "Le mot de passe doit faire au moins 6 caractères.");
  const { hash, salt } = hashPassword(password);
  return transact((db) => {
    if (db.users.some((u) => u.usernameLower === username.toLowerCase()))
      throw new AppError(409, "Ce pseudo est déjà utilisé.");
    const user: UserRow = {
      id: newId("u_"),
      username,
      usernameLower: username.toLowerCase(),
      passwordHash: hash,
      salt,
      role: db.users.length === 0 ? "ADMIN" : "JOUEUR", // le premier compte créé est administrateur
      level: "normal",
      coris: 0,
      lions: 0,
      fcfa: 0,
      createdAt: nowIso(),
    };
    db.users.push(user);
    walletMove(db, user, "coris", toUnits(SIGNUP_BONUS_CORIS), "bonus", "Bonus de bienvenue");
    return { token: createSession(db, user.id), user };
  });
}

export function login(usernameRaw: unknown, passwordRaw: unknown) {
  const username = String(usernameRaw ?? "").trim().toLowerCase();
  const password = String(passwordRaw ?? "");
  return transact((db) => {
    const user = db.users.find((u) => u.usernameLower === username);
    if (!user || !verifyPassword(password, user.salt, user.passwordHash))
      throw new AppError(401, "Pseudo ou mot de passe incorrect.");
    return { token: createSession(db, user.id), user };
  });
}

export function logout(token: string | null) {
  if (!token) return;
  transact((db) => {
    db.sessions = db.sessions.filter((s) => s.token !== token);
  });
}

export function upgradeToPro(userId: string) {
  return transact((db) => {
    const u = getUser(db, userId);
    if (u.level === "pro") throw new AppError(400, "Vous êtes déjà Pro.");
    u.level = "pro";
    u.proSince = nowIso();
    return u;
  });
}

/** Conversion Coris -> Lions (50 Coris = 1 Lion). Réservée aux joueurs Pro. */
export function convertCorisToLions(userId: string, lionsRaw: unknown) {
  const lions = Number(lionsRaw);
  if (!Number.isInteger(lions) || lions < 1 || lions > 100000)
    throw new AppError(400, "Indiquez un nombre entier de Lions (au moins 1).");
  return transact((db) => {
    const u = getUser(db, userId);
    if (u.level !== "pro") throw new AppError(403, "Passez d'abord au niveau Pro.");
    const cost = toUnits(lions * CORIS_PER_LION);
    if (u.coris < cost) throw new AppError(400, `Solde insuffisant : il faut ${lions * CORIS_PER_LION} Coris.`);
    walletMove(db, u, "coris", -cost, "conversion_debit", `Conversion en ${lions} Lion(s)`);
    walletMove(db, u, "lions", toUnits(lions), "conversion_credit", `Conversion de ${lions * CORIS_PER_LION} Coris`);
    return u;
  });
}

/** Conversion Lions -> F CFA (taux FCFA_PER_LION). Réservée aux joueurs Pro, par nombre entier de Lions. */
export function convertLionsToFcfa(userId: string, lionsRaw: unknown) {
  const lions = Number(lionsRaw);
  if (!Number.isInteger(lions) || lions < 1 || lions > 100000)
    throw new AppError(400, "Indiquez un nombre entier de Lions (au moins 1).");
  return transact((db) => {
    const u = getUser(db, userId);
    if (u.level !== "pro") throw new AppError(403, "La conversion des Lions en F CFA est réservée aux joueurs Pro.");
    if (u.lions < toUnits(lions)) throw new AppError(400, `Solde insuffisant : vous n'avez pas ${lions} Lion(s).`);
    const fcfa = lions * FCFA_PER_LION;
    walletMove(db, u, "lions", -toUnits(lions), "conversion_debit", `Conversion en ${fcfa.toLocaleString("fr-FR")} F CFA`);
    walletMove(db, u, "fcfa", toUnits(fcfa), "conversion_credit", `Conversion de ${lions} Lion(s)`);
    return u;
  });
}
