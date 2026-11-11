"use client";

import { useState } from "react";
import { api, fmtAmount } from "@/lib/client";
import type { PublicUser } from "@/lib/types";
import { useSession } from "./SessionProvider";
import type { AppConfig } from "./SessionProvider";
import { Alert, Button, ButtonLink, Card, Money, PageTitle, Spinner, inputClass, useRequireAuth } from "./ui";

export function ProClient() {
  const { me, loading, config } = useRequireAuth();
  const { setMe } = useSession();
  const [convertCount, setConvertCount] = useState(1);
  const [buyCount, setBuyCount] = useState(1);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || !me || !config) return <Spinner />;

  return (
    <PasserProScreen
      me={me}
      config={config}
      convertCount={convertCount}
      buyCount={buyCount}
      setConvertCount={setConvertCount}
      setBuyCount={setBuyCount}
      msg={msg}
      busy={busy}
      onPost={async (body, ok) => {
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
      }}
    />
  );
}

export function PasserProScreen({
  me,
  config,
  convertCount,
  buyCount,
  setConvertCount,
  setBuyCount,
  msg,
  busy,
  onPost,
}: {
  me: PublicUser;
  config: AppConfig;
  convertCount: number;
  buyCount: number;
  setConvertCount: (n: number) => void;
  setBuyCount: (n: number) => void;
  msg: { kind: "error" | "success"; text: string } | null;
  busy: boolean;
  onPost: (body: Record<string, unknown>, ok: string) => void;
}) {
  const rate = config.CORIS_PER_LION;
  const fcfaRate = config.FCFA_PER_LION;
  const isPro = me.level === "pro";
  const maxFromCoris = Math.floor(me.coris / rate);
  const maxFromFcfa = Math.floor(me.fcfa / fcfaRate);
  const convertCost = (Number.isFinite(convertCount) ? convertCount : 0) * rate;
  const buyCost = (Number.isFinite(buyCount) ? buyCount : 0) * fcfaRate;

  function post(body: Record<string, unknown>, ok: string) {
    onPost(body, ok);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle
        title="Passez Pro"
        subtitle="Convertissez les Coris gagnés dans les parties gratuites, ou achetez des Lions avec vos F CFA."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-sm text-slate-400">Coris</div>
          <div className="mt-1 text-2xl">
            <Money amount={me.coris} currency="coris" className="text-amber-300" />
          </div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Lions</div>
          <div className="mt-1 text-2xl">
            <Money amount={me.lions} currency="lions" className="text-fuchsia-300" />
          </div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">F CFA</div>
          <div className="mt-1 text-2xl">
            <Money amount={me.fcfa} currency="fcfa" className="text-emerald-300" />
          </div>
        </Card>
      </div>

      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {!isPro && (
        <Card className="border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 to-transparent p-6">
          <h2 className="text-xl font-bold">Devenir Pro, c&apos;est gratuit</h2>
          <p className="mt-2 text-sm text-slate-300">
            Le niveau Pro débloque la conversion des Coris, l&apos;achat de Lions et les parties en Lions. Vos parties en Coris restent ouvertes.
          </p>
          <Button
            variant="pro"
            className="mt-5"
            disabled={busy}
            onClick={() => post({ action: "upgrade" }, "Vous êtes Pro. Vous pouvez convertir vos Coris ou acheter des Lions.")}
          >
            Devenir Pro
          </Button>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-xl font-bold">Convertir les Coris gagnés</h2>
        <p className="mt-1 text-sm text-slate-400">
          Les Coris des parties gratuites deviennent des Lions. Taux : <strong className="text-white">{rate} Coris = 1 Lion</strong>.
          Vous pouvez en obtenir jusqu&apos;à <strong className="text-white">{maxFromCoris}</strong>.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-sm text-slate-300">Nombre de Lions</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, maxFromCoris)}
              step={1}
              value={Number.isFinite(convertCount) ? convertCount : ""}
              onChange={(e) => setConvertCount(parseInt(e.target.value, 10))}
              className={inputClass}
            />
          </label>
          <Button
            variant="pro"
            className="py-3"
            disabled={busy || !isPro || !Number.isInteger(convertCount) || convertCount < 1 || convertCount > maxFromCoris}
            onClick={() => post({ action: "convert", lions: convertCount }, `${convertCount} Lion(s) ajouté(s) depuis vos Coris.`)}
          >
            Convertir {fmtAmount(convertCost)} Coris
          </Button>
        </div>
        <AmountChips max={maxFromCoris} onPick={setConvertCount} />
        {!isPro && <p className="mt-3 text-xs text-slate-400">Devenez Pro pour convertir vos Coris.</p>}
      </Card>

      <Card className="border-emerald-400/20 p-6">
        <h2 className="text-xl font-bold">Acheter des Lions</h2>
        <p className="mt-1 text-sm text-slate-400">
          Le paiement se fait avec votre solde F CFA. Taux : <strong className="text-white">1 Lion = {fcfaRate.toLocaleString("fr-FR")} F CFA</strong>.
          Vous pouvez en acheter jusqu&apos;à <strong className="text-white">{maxFromFcfa}</strong>.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-sm text-slate-300">Nombre de Lions</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, maxFromFcfa)}
              step={1}
              value={Number.isFinite(buyCount) ? buyCount : ""}
              onChange={(e) => setBuyCount(parseInt(e.target.value, 10))}
              className={inputClass}
            />
          </label>
          <Button
            className="py-3"
            disabled={busy || !isPro || !Number.isInteger(buyCount) || buyCount < 1 || buyCount > maxFromFcfa}
            onClick={() => post({ action: "buy", lions: buyCount }, `${buyCount} Lion(s) acheté(s).`)}
          >
            Acheter pour {buyCost.toLocaleString("fr-FR")} F CFA
          </Button>
        </div>
        <AmountChips max={maxFromFcfa} onPick={setBuyCount} />
        {maxFromFcfa < 1 && (
          <p className="mt-3 text-sm text-slate-300">
            Votre solde F CFA ne couvre pas encore un Lion.{" "}
            <ButtonLink href="/portefeuille" variant="ghost" className="ml-1 px-3 py-1.5">
              Déposer des F CFA
            </ButtonLink>
          </p>
        )}
        {!isPro && <p className="mt-3 text-xs text-slate-400">Devenez Pro pour acheter des Lions.</p>}
      </Card>

      <div>
        <ButtonLink href="/salon" variant="ghost">
          Retour au salon
        </ButtonLink>
      </div>
    </div>
  );
}

function AmountChips({ max, onPick }: { max: number; onPick: (n: number) => void }) {
  const values = [1, 2, 5, 10, max].filter((v, i, a) => v >= 1 && v <= max && a.indexOf(v) === i);
  if (!values.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {values.map((v) => (
        <button key={v} type="button" onClick={() => onPick(v)} className="rounded-lg bg-white/5 px-3 py-1 text-xs hover:bg-white/10">
          {v === max ? `Max (${v})` : v}
        </button>
      ))}
    </div>
  );
}
