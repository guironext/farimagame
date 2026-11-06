import { CORIS_PER_LION, FCFA_PER_LION, SIGNUP_BONUS_CORIS, toUnits } from "../config";
import type { Currency } from "../types";
import { newId, nowIso, readDb, transact, type Db, type HouseTxRow, type TxRow, type UserRow } from "./db";
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

/** Transforme un pseudo / prénom / e-mail en pseudo FarimaGame valide (3 à 20 caractères : lettres, chiffres, _ . -). */
function cleanUsername(raw: string | null | undefined): string {
  const s = String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_.-]+/g, "")
    .slice(0, 20);
  return s.length >= 3 ? s : "";
}

function uniqueUsername(db: Db, base: string): string {
  const taken = new Set(db.users.map((u) => u.usernameLower));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const suffix = String(i);
    const candidate = base.slice(0, 20 - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export interface ExternalProfile {
  username?: string | null;
  firstName?: string | null;
  email?: string | null;
}

/**
 * Fiche joueur liée à un compte Clerk (clerkId). Créée à la première visite :
 * rôle JOUEUR (ADMIN si aucun administrateur ne peut encore se connecter), niveau normal, 500 Coris de bienvenue.
 * Pseudo : pseudo Clerk, sinon prénom, sinon début de l'e-mail, sinon « joueur » ; rendu unique (gerard, gerard2…).
 */
export async function provisionUser(clerkId: string, profile: ExternalProfile): Promise<UserRow> {
  const found = (await readDb()).users.find((u) => u.clerkId === clerkId);
  if (found) return found;
  return transact((db) => {
    const again = db.users.find((u) => u.clerkId === clerkId);
    if (again) return again;
    const email = profile.email?.trim().toLowerCase() || undefined;
    const base =
      cleanUsername(profile.username) || cleanUsername(profile.firstName) || cleanUsername(email?.split("@")[0]) || "joueur";
    const username = uniqueUsername(db, base);
    // Les anciens comptes à mot de passe ne peuvent plus se connecter : seul un admin relié à Clerk compte.
    const hasActiveAdmin = db.users.some((u) => u.role === "ADMIN" && u.clerkId);
    const user: UserRow = {
      id: newId("u_"),
      clerkId,
      email,
      username,
      usernameLower: username.toLowerCase(),
      role: hasActiveAdmin ? "JOUEUR" : "ADMIN",
      level: "normal",
      coris: 0,
      lions: 0,
      fcfa: 0,
      createdAt: nowIso(),
    };
    db.users.push(user);
    walletMove(db, user, "coris", toUnits(SIGNUP_BONUS_CORIS), "bonus", "Bonus de bienvenue");
    return user;
  });
}

export async function upgradeToPro(userId: string) {
  return transact((db) => {
    const u = getUser(db, userId);
    if (u.level === "pro") throw new AppError(400, "Vous êtes déjà Pro.");
    u.level = "pro";
    u.proSince = nowIso();
    return u;
  });
}

/** Conversion Coris -> Lions (50 Coris = 1 Lion). Réservée aux joueurs Pro. */
export async function convertCorisToLions(userId: string, lionsRaw: unknown) {
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
export async function convertLionsToFcfa(userId: string, lionsRaw: unknown) {
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
