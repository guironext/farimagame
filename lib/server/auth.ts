// Authentification : Clerk (https://clerk.com) gère les comptes, les mots de passe et les sessions.
// FarimaGame garde son propre enregistrement « joueur » (portefeuilles Coris / Lions / F CFA, rôle, niveau)
// dans data/db.json, relié au compte Clerk par clerkId et créé automatiquement à la première visite
// d'un compte Clerk connecté (500 Coris de bienvenue, rôle JOUEUR).
import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { readDb, type UserRow } from "./db";
import { AppError } from "./errors";
import { provisionUser } from "./wallet";
import { CLERK_ENABLED } from "../clerk";
import { fromUnits } from "../config";
import { canManageMoney, type PublicUser, type Role } from "../types";

/** En-tête utilisé UNIQUEMENT par les tests automatiques (scripts/test-paris.mjs), voir testUser(). */
export const TEST_USER_HEADER = "x-farima-test-user";

/**
 * Connexion de test, sans Clerk. Triple verrou :
 *  1. NODE_ENV !== "production" : Next.js remplace process.env.NODE_ENV à la compilation, donc dans un
 *     `next build` / `next start` ce bloc est supprimé du code : impossible à activer en production ;
 *  2. FARIMA_TEST_AUTH=1 doit être défini au lancement du serveur ;
 *  3. FARIMA_DATA_DIR doit pointer vers une base de test séparée (jamais data/db.json).
 * Renvoie undefined quand le mode test n'est pas actif (on passe alors par Clerk).
 */
async function testUser(): Promise<UserRow | undefined> {
  if (process.env.NODE_ENV !== "production") {
    if (process.env.FARIMA_TEST_AUTH === "1" && process.env.FARIMA_DATA_DIR) {
      const name = (await headers()).get(TEST_USER_HEADER)?.trim();
      if (name) return await provisionUser(`test:${name.toLowerCase()}`, { username: name, email: `${name.toLowerCase()}@test.invalid` });
    }
  }
  return undefined;
}

/** Utilisateur connecté (crée sa fiche joueur à la première visite) ou null. */
export async function currentUser(): Promise<UserRow | null> {
  const t = await testUser();
  if (t) return t;
  if (!CLERK_ENABLED) return null;

  const { userId } = await auth();
  if (!userId) return null;
  const existing = (await readDb()).users.find((u) => u.clerkId === userId);
  if (existing) return existing;

  // Première visite de ce compte Clerk : on lit son profil (pseudo, prénom, e-mail) pour créer la fiche joueur.
  const cu = await clerkCurrentUser();
  if (!cu) return null;
  const email = cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses?.[0]?.emailAddress ?? null;
  return await provisionUser(userId, { username: cu.username, firstName: cu.firstName, email });
}

export const getCurrentUser = currentUser;

/** Renvoie l'identifiant (FarimaGame) de l'utilisateur connecté, ou lève 401. */
export async function requireUserId(): Promise<string> {
  const u = await currentUser();
  if (!u) throw new AppError(401, "Vous devez être connecté.");
  return u.id;
}

const envList = (name: string) =>
  (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const listed = (u: UserRow, emails: string[], names: string[]) =>
  (!!u.email && emails.includes(u.email.toLowerCase())) || names.includes(u.usernameLower);

/**
 * Rôle effectif.
 *  - ADMIN_EMAILS / ADMIN_USERNAMES désignent les administrateurs.
 *  - HOME_EMAILS / HOME_USERNAMES désignent la Maison (argent de la plateforme).
 *  - Une liste remplace le rôle enregistré pour ce rôle-là. Sans liste, le rôle enregistré
 *    est conservé : le premier compte qui se connecte devient ADMIN s'il n'existe encore
 *    aucun administrateur capable de se connecter (voir provisionUser).
 */
export function effectiveRole(u: UserRow): Role {
  const adminEmails = envList("ADMIN_EMAILS");
  const adminNames = envList("ADMIN_USERNAMES");
  const homeEmails = envList("HOME_EMAILS");
  const homeNames = envList("HOME_USERNAMES");
  const adminListed = adminEmails.length > 0 || adminNames.length > 0;
  const homeListed = homeEmails.length > 0 || homeNames.length > 0;

  if (homeListed && listed(u, homeEmails, homeNames)) return "HOME";
  if (adminListed && listed(u, adminEmails, adminNames)) return "ADMIN";
  // Manager et Maison attribués par l'administrateur restent valables.
  // Une liste d'e-mails ne retire que le rôle qu'elle remplace.
  if (u.role === "MANAGER") return "MANAGER";
  if (u.role === "HOME" && !homeListed) return "HOME";
  if (u.role === "ADMIN" && !adminListed) return "ADMIN";
  return "JOUEUR";
}

export const isAdmin = (u: UserRow) => effectiveRole(u) === "ADMIN";
export const isHome = (u: UserRow) => effectiveRole(u) === "HOME";

/** Renvoie l'identifiant de l'administrateur connecté, ou lève 401 / 403. */
export async function requireAdminId(): Promise<string> {
  const u = await currentUser();
  if (!u) throw new AppError(401, "Vous devez être connecté.");
  if (!isAdmin(u)) throw new AppError(403, "Accès réservé aux administrateurs.");
  return u.id;
}

/** Caisse, commissions, dépôts, retraits et règlement des mises. Maison ou administrateur. */
export async function requireMoneyId(): Promise<string> {
  const u = await currentUser();
  if (!u) throw new AppError(401, "Vous devez être connecté.");
  if (!canManageMoney(effectiveRole(u))) throw new AppError(403, "Accès réservé à la Maison.");
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
