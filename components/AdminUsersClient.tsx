"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { Alert, Button, Card, Money, PageTitle, Spinner, inputClass, useRequireAuth } from "./ui";

interface Account {
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

interface Invite {
  id: string;
  email: string;
  role: "MANAGER" | "HOME";
  status: string;
  createdAt: string;
}

const ASSIGNABLE: Role[] = ["JOUEUR", "MANAGER", "HOME"];

export function AdminUsersClient() {
  const { me, loading } = useRequireAuth();
  const [users, setUsers] = useState<Account[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MANAGER" | "HOME">("MANAGER");
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ users: Account[]; invites: Invite[] }>("/api/admin/users");
    setUsers(data.users);
    setInvites(data.invites);
    setRoles(Object.fromEntries(data.users.map((u) => [u.id, u.role])));
  }, []);

  useEffect(() => {
    if (!me || me.role !== "ADMIN") return;
    load().catch((e) => setMsg({ kind: "error", text: (e as Error).message }));
  }, [me, load]);

  if (loading || !me) return <Spinner />;
  if (me.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-bold">Accès réservé</h1>
        <p className="mt-2 text-sm text-slate-400">Seul l&apos;administrateur peut gérer les comptes.</p>
      </div>
    );
  }
  if (!users) return <Spinner />;

  const shown = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.username.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  async function saveRole(userId: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ user: Account }>("/api/admin/users", { action: "role", userId, role: roles[userId] });
      setUsers((list) => list?.map((u) => (u.id === userId ? r.user : u)) ?? null);
      setMsg({ kind: "success", text: `${r.user.username} est maintenant ${ROLE_LABEL[r.user.role]}.` });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ invite: Invite; emailSent: boolean; emailError: string | null }>("/api/admin/users", {
        action: "invite",
        email,
        role: inviteRole,
      });
      setInvites((list) => [r.invite, ...list]);
      setEmail("");
      setMsg({
        kind: r.emailSent ? "success" : "info",
        text: r.emailSent
          ? `Invitation ${ROLE_LABEL[r.invite.role]} envoyée à ${r.invite.email}.`
          : `Invitation enregistrée pour ${r.invite.email}. L'e-mail n'est pas parti : ${r.emailError}`,
      });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inviteId: string) {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/admin/users", { action: "revoke", inviteId });
      setInvites((list) => list.filter((i) => i.id !== inviteId));
      setMsg({ kind: "success", text: "Invitation annulée." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="Comptes" subtitle="Consultez les joueurs, changez leur rôle, et invitez un Manager ou la Maison." />
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <Card className="p-6">
        <h2 className="text-xl font-bold">Inviter un compte</h2>
        <p className="mt-1 text-sm text-slate-400">
          La personne crée son compte avec cette adresse. Elle reçoit le rôle choisi, et un e-mail d&apos;invitation quand l&apos;envoi fonctionne.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <label>
            <span className="mb-1 block text-sm text-slate-300">E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="nom@exemple.com" />
          </label>
          <label>
            <span className="mb-1 block text-sm text-slate-300">Rôle</span>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "MANAGER" | "HOME")} className={inputClass}>
              <option value="MANAGER">Manager</option>
              <option value="HOME">Maison</option>
            </select>
          </label>
          <Button variant="pro" className="py-3" disabled={busy || !email.trim()} onClick={invite}>
            Envoyer
          </Button>
        </div>
      </Card>

      {invites.length > 0 && (
        <Card>
          <h2 className="font-semibold">Invitations en attente</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">{i.email}</div>
                  <div className="text-xs text-slate-400">{ROLE_LABEL[i.role]}</div>
                </div>
                <Button variant="ghost" disabled={busy} onClick={() => revoke(i.id)}>
                  Annuler
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">{users.length} compte{users.length > 1 ? "s" : ""}</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un pseudo ou un e-mail" className={inputClass + " sm:max-w-xs"} />
        </div>
        <ul className="mt-4 space-y-3">
          {shown.map((u) => (
            <li key={u.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{u.username}</div>
                  <div className="text-sm text-slate-400">{u.email || "E-mail non renseigné"}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white/10 px-2.5 py-1">{ROLE_LABEL[u.role]}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1">{u.level === "pro" ? "Pro" : "Normal"}</span>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div><Money amount={u.coris} currency="coris" className="text-amber-300" /></div>
                  <div><Money amount={u.lions} currency="lions" className="text-fuchsia-300" /></div>
                  <div><Money amount={u.fcfa} currency="fcfa" className="text-emerald-300" /></div>
                </div>
              </div>
              {u.locked ? (
                <p className="mt-3 text-xs text-slate-500">Administrateur : le rôle de ce compte n&apos;est pas modifié ici.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={ASSIGNABLE.includes(roles[u.id]) ? roles[u.id] : "JOUEUR"}
                    onChange={(e) => setRoles((prev) => ({ ...prev, [u.id]: e.target.value as Role }))}
                    className={inputClass}
                  >
                    {ASSIGNABLE.map((role) => (
                      <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                    ))}
                  </select>
                  <Button disabled={busy || roles[u.id] === u.role} onClick={() => saveRole(u.id)}>
                    Enregistrer
                  </Button>
                </div>
              )}
            </li>
          ))}
          {shown.length === 0 && <li className="text-sm text-slate-400">Aucun compte ne correspond.</li>}
        </ul>
      </Card>
    </div>
  );
}
