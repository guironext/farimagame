"use client";

import { useState } from "react";
import { api, fmtAmount } from "@/lib/client";
import type { PublicUser } from "@/lib/types";
import { useSession } from "./SessionProvider";
import { Alert, Button, ButtonLink, Card, Money, PageTitle, Spinner, inputClass, useRequireAuth } from "./ui";

export function ProClient() {
  const { me, loading, config } = useRequireAuth();
  const { setMe } = useSession();
  const [lions, setLions] = useState(1);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || !me || !config) return <Spinner />;
  const rate = config.CORIS_PER_LION;
  const maxLions = Math.floor(me.coris / rate);
  const cost = (Number.isFinite(lions) ? lions : 0) * rate;

  async function post(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ user: PublicUser }>("/api/pro", body);
      setMe(r.user);
      setMsg({ kind: "success", text: ok });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="🦁 Niveau Pro" subtitle={`Convertissez vos Coris en Lions (${rate} Coris = 1 Lion) et jouez en Lions.`} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="text-sm text-slate-400">Coris disponibles</div>
          <div className="mt-1 text-2xl"><Money amount={me.coris} currency="coris" className="text-amber-300" /></div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Lions disponibles</div>
          <div className="mt-1 text-2xl"><Money amount={me.lions} currency="lions" className="text-fuchsia-300" /></div>
        </Card>
      </div>

      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {me.level !== "pro" ? (
        <Card className="border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 to-transparent p-6">
          <h2 className="text-xl font-bold">Passer au niveau Pro</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>• Convertissez les Coris gagnés pendant vos parties en Lions : {rate} Coris = 1 Lion.</li>
            <li>• Jouez les jeux de votre choix en misant {config.PRO_STAKE_LIONS} Lion(s) par partie.</li>
            <li>• Contre l&apos;ordinateur ou à 2, 3 ou 4 joueurs selon le jeu.</li>
            <li>• Le gagnant reçoit 80 % des mises, la maison garde 20 %.</li>
            <li>• Vous pouvez toujours jouer en Coris.</li>
          </ul>
          <Button variant="pro" className="mt-6" disabled={busy} onClick={() => post({ action: "upgrade" }, "Félicitations, vous êtes maintenant Pro ! Convertissez vos Coris ci-dessous.")}>
            Devenir Pro (gratuit)
          </Button>
        </Card>
      ) : (
        <Card className="border-fuchsia-400/30 p-6">
          <h2 className="text-xl font-bold">Convertir des Coris en Lions</h2>
          <p className="mt-1 text-sm text-slate-400">
            Vous pouvez obtenir jusqu&apos;à <strong className="text-white">{maxLions}</strong> Lion(s) avec vos Coris.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-1 block text-sm text-slate-300">Nombre de Lions</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, maxLions)}
                step={1}
                value={Number.isFinite(lions) ? lions : ""}
                onChange={(e) => setLions(parseInt(e.target.value, 10))}
                className={inputClass}
              />
            </label>
            <Button
              variant="pro"
              className="py-3"
              disabled={busy || !Number.isInteger(lions) || lions < 1 || lions > maxLions}
              onClick={() => post({ action: "convert", lions }, `${lions} Lion(s) ajouté(s) à votre compte.`)}
            >
              Convertir {fmtAmount(cost)} Coris
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 2, 5, maxLions].filter((v, i, a) => v >= 1 && v <= maxLions && a.indexOf(v) === i).map((v) => (
              <button key={v} onClick={() => setLions(v)} className="rounded-lg bg-white/5 px-3 py-1 text-xs hover:bg-white/10">
                {v === maxLions ? `Max (${v})` : v}
              </button>
            ))}
          </div>
          <div className="mt-6">
            <ButtonLink href="/salon" variant="ghost">🎮 Jouer en Lions</ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
