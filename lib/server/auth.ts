import crypto from "node:crypto";
import { cookies } from "next/headers";
import { readDb, type Db, type UserRow } from "./db";
import { AppError } from "./errors";
import { fromUnits } from "../config";
import type { PublicUser, Role } from "../types";

export const SESSION_COOKIE = "fg_session";
export const SESSION_DAYS = 30;

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const h = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === h.length && crypto.timingSafeEqual(h, expected);
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.SECURE_COOKIES === "1",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  const c = await cookies();
  return c.get(SESSION_COOKIE)?.value ?? null;
}

export function userFromToken(db: Db, token: string | null): UserRow | null {
  if (!token) return null;
  const s = db.sessions.find((x) => x.token === token);
  if (!s || new Date(s.expiresAt).getTime() < Date.now()) return null;
  return db.users.find((u) => u.id === s.userId) ?? null;
}

/** Utilisateur connecté (lecture seule) ou null. */
export async function currentUser(): Promise<UserRow | null> {
  const token = await getSessionToken();
  return userFromToken(readDb(), token);
}

/** Renvoie l'identifiant de l'utilisateur connecté, ou lève 401. */
export async function requireUserId(): Promise<string> {
  const u = await currentUser();
  if (!u) throw new AppError(401, "Vous devez être connecté.");
  return u.id;
}

/**
 * Rôle effectif. Si la variable d'environnement ADMIN_USERNAMES est définie (pseudos séparés par des virgules),
 * seuls ces comptes sont ADMIN. Sinon, c'est le rôle enregistré (le premier compte créé est ADMIN).
 */
export function effectiveRole(u: UserRow): Role {
  const list = (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length > 0) return list.includes(u.usernameLower) ? "ADMIN" : "JOUEUR";
  return u.role === "ADMIN" ? "ADMIN" : "JOUEUR";
}

export const isAdmin = (u: UserRow) => effectiveRole(u) === "ADMIN";

/** Renvoie l'identifiant de l'administrateur connecté, ou lève 401 / 403. */
export async function requireAdminId(): Promise<string> {
  const u = await currentUser();
  if (!u) throw new AppError(401, "Vous devez être connecté.");
  if (!isAdmin(u)) throw new AppError(403, "Accès réservé aux administrateurs.");
  return u.id;
}

export function publicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    username: u.username,
    role: effectiveRole(u),
    level: u.level,
    coris: fromUnits(u.coris),
    lions: fromUnits(u.lions),
    fcfa: fromUnits(u.fcfa ?? 0),
    createdAt: u.createdAt,
  };
}
