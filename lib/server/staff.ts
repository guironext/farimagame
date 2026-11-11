import { fromUnits } from "../config";
import type { Role } from "../types";
import { effectiveRole } from "./auth";
import { newId, nowIso, readDb, transact, type StaffInvite } from "./db";
import { AppError } from "./errors";
import { getUser } from "./wallet";

export type StaffRole = "MANAGER" | "HOME";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AdminAccount {
  id: string;
  username: string;
  email: string | null;
  role: Role;
  level: "normal" | "pro";
  coris: number;
  lions: number;
  fcfa: number;
  createdAt: string;
  locked: boolean;
}

function cleanEmail(raw: unknown) {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 120) throw new AppError(400, "Indiquez une adresse e-mail valide.");
  return email;
}

function staffRole(raw: unknown): StaffRole {
  if (raw === "MANAGER" || raw === "HOME") return raw;
  throw new AppError(400, "Choisissez le rôle Manager ou Maison.");
}

function accountOf(u: Parameters<typeof effectiveRole>[0]): AdminAccount {
  const role = effectiveRole(u);
  return {
    id: u.id,
    username: u.username,
    email: u.email ?? null,
    role,
    level: u.level,
    coris: fromUnits(u.coris),
    lions: fromUnits(u.lions),
    fcfa: fromUnits(u.fcfa ?? 0),
    createdAt: u.createdAt,
    locked: role === "ADMIN",
  };
}

export async function listAccounts() {
  const db = await readDb();
  return {
    users: db.users.map(accountOf).sort((a, b) => a.username.localeCompare(b.username, "fr")),
    invites: db.staffInvites.filter((i) => i.status === "pending"),
  };
}

export async function setAccountRole(actorId: string, userId: unknown, roleRaw: unknown) {
  const role = roleRaw === "JOUEUR" || roleRaw === "MANAGER" || roleRaw === "HOME" ? roleRaw : null;
  if (!role) throw new AppError(400, "Rôle inconnu.");
  const id = String(userId ?? "");
  return transact((db) => {
    const u = getUser(db, id);
    if (u.id === actorId) throw new AppError(400, "Vous ne pouvez pas modifier votre propre rôle.");
    if (effectiveRole(u) === "ADMIN") throw new AppError(400, "Le rôle d'administrateur se règle par l'e-mail du compte, pas ici.");
    u.role = role;
    return accountOf(u);
  });
}

async function clerkInvite(email: string, role: StaffRole, redirectUrl: string) {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) return { sent: false, reason: "L'envoi d'e-mail n'est pas configuré." };
  const res = await fetch("https://api.clerk.com/v1/invitations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email_address: email,
      public_metadata: { farimaRole: role },
      redirect_url: redirectUrl,
      notify: true,
    }),
  });
  const body = (await res.json().catch(() => null)) as { id?: string; errors?: { long_message?: string; message?: string }[] } | null;
  if (!res.ok) {
    const reason = body?.errors?.map((e) => e.long_message || e.message).filter(Boolean).join(" ") || "L'e-mail n'a pas pu être envoyé.";
    return { sent: false, reason };
  }
  return { sent: true, id: body?.id };
}

export async function inviteStaff(actorId: string, emailRaw: unknown, roleRaw: unknown, redirectUrl: string) {
  const email = cleanEmail(emailRaw);
  const role = staffRole(roleRaw);
  const db = await readDb();
  const existing = db.users.some((u) => u.email === email) ? "user" : db.staffInvites.some((i) => i.status === "pending" && i.email === email) ? "invite" : null;
  if (existing === "user") throw new AppError(400, "Ce joueur a déjà un compte. Changez son rôle dans la liste.");
  if (existing === "invite") throw new AppError(400, "Une invitation est déjà en attente pour cet e-mail.");

  const mail = await clerkInvite(email, role, redirectUrl);
  const invite = await transact((db) => {
    const row: StaffInvite = {
      id: newId("inv_"),
      email,
      role,
      status: "pending",
      createdAt: nowIso(),
      createdBy: actorId,
      clerkInvitationId: mail.id,
    };
    db.staffInvites.push(row);
    return row;
  });
  return { invite, emailSent: mail.sent, emailError: mail.sent ? null : mail.reason };
}

export async function revokeStaffInvite(inviteId: unknown) {
  const id = String(inviteId ?? "");
  const invite = await transact((db) => {
    const row = db.staffInvites.find((i) => i.id === id && i.status === "pending");
    if (!row) throw new AppError(404, "Invitation introuvable.");
    row.status = "revoked";
    return row;
  });
  const key = process.env.CLERK_SECRET_KEY;
  if (key && invite.clerkInvitationId) {
    await fetch(`https://api.clerk.com/v1/invitations/${invite.clerkInvitationId}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
    }).catch(() => undefined);
  }
  return invite;
}
