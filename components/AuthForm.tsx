"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import type { PublicUser } from "@/lib/types";
import { useSession } from "./SessionProvider";
import { Alert, Button, Card, inputClass } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { setMe } = useSession();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "register" && password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ user: PublicUser }>(mode === "login" ? "/api/auth/login" : "/api/auth/register", { username, password });
      setMe(r.user);
      router.push(mode === "register" ? "/tableau-de-bord?bienvenue=1" : "/salon");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{mode === "login" ? "Connexion" : "Créer un compte joueur"}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {mode === "login" ? "Content de vous revoir !" : "Recevez 500 Coris de bienvenue pour commencer à jouer."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Pseudo</span>
            <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={20} placeholder="ex : Gerard225" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Mot de passe</span>
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} />
          </label>
          {mode === "register" && (
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Confirmer le mot de passe</span>
              <input className={inputClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={6} />
            </label>
          )}
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? "Patientez…" : mode === "login" ? "Se connecter" : "S'inscrire et recevoir 500 Coris"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          {mode === "login" ? (
            <>Pas encore de compte ? <Link href="/inscription" className="font-semibold text-amber-300">Inscrivez-vous</Link></>
          ) : (
            <>Déjà inscrit ? <Link href="/connexion" className="font-semibold text-amber-300">Connectez-vous</Link></>
          )}
        </p>
      </Card>
    </div>
  );
}
