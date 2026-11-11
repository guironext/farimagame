"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, idParam } from "@/lib/client";
import { OPERATORS, formatPhone, operatorName } from "@/lib/payments/types";
import type { MobileOperator, PaymentStatus, PaymentView, PublicUser, TxView } from "@/lib/types";
import { useSession } from "./SessionProvider";
import { Alert, Button, ButtonLink, Card, Money, PageTitle, Spinner, Tabs, cx, inputClass, useRequireAuth } from "./ui";

interface WalletData {
  transactions: TxView[];
  payments: PaymentView[];
  provider: { id: string; label: string; isSimulation: boolean };
}

type Tab = "depot" | "retrait" | "convertir";

const PAY_STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-amber-500/20 text-amber-200" },
  completed: { label: "Effectué", cls: "bg-emerald-500/20 text-emerald-200" },
  failed: { label: "Échoué", cls: "bg-rose-500/20 text-rose-200" },
  rejected: { label: "Refusé", cls: "bg-rose-500/20 text-rose-200" },
};

export function WalletClient() {
  const { me, loading, config } = useRequireAuth();
  const { setMe } = useSession();
  const [data, setData] = useState<WalletData | null>(null);
  const [tab, setTab] = useState<Tab>("depot");
  const [operator, setOperator] = useState<MobileOperator>("orange");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number>(5000);
  const [lions, setLions] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);

  const load = useCallback(() => api<WalletData>("/api/portefeuille").then(setData).catch(() => {}), []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("onglet") as Tab | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t === "depot" || t === "retrait" || t === "convertir") setTab(t);
  }, []);

  useEffect(() => {
    if (me) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, load]);

  if (loading || !me || !config || !data) return <Spinner />;

  const isPro = me.level === "pro";
  const maxLions = Math.floor(me.lions);
  const [min, max] = tab === "retrait" ? [config.WITHDRAW_MIN_FCFA, config.WITHDRAW_MAX_FCFA] : [config.DEPOSIT_MIN_FCFA, config.DEPOSIT_MAX_FCFA];
  const validAmount = Number.isInteger(amount) && amount >= min && amount <= max;

  async function submit(action: "deposit" | "withdraw" | "convert") {
    setBusy(true);
    setMsg(action === "deposit" ? { kind: "info", text: "📱 Confirmation sur votre téléphone… (simulation)" } : null);
    try {
      if (action === "deposit") await new Promise((r) => setTimeout(r, 1200)); // effet "validation opérateur" simulé
      const r = await api<{ user: PublicUser; payment?: PaymentView }>("/api/portefeuille", { action, operator, phone, amount, lions });
      setMe(r.user);
      if (action === "convert") setMsg({ kind: "success", text: `${lions} Lion(s) converti(s) en ${(lions * config!.FCFA_PER_LION).toLocaleString("fr-FR")} F CFA.` });
      else if (r.payment?.status === "failed") setMsg({ kind: "error", text: r.payment.message ?? "Opération refusée." });
      else if (action === "deposit") setMsg({ kind: "success", text: `Dépôt de ${amount.toLocaleString("fr-FR")} F CFA crédité (${operatorName(operator)}, simulation).` });
      else setMsg({ kind: "success", text: `Demande de retrait de ${amount.toLocaleString("fr-FR")} F CFA enregistrée. Elle sera traitée par un administrateur.` });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="💳 Mon portefeuille" subtitle="Votre solde en F CFA pour les paris sportifs : dépôt Mobile Money, retrait et conversion de vos Lions." />

      {data.provider.isSimulation && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <span className="mt-0.5 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-slate-950">Démo</span>
          <div>
            <strong>Mode démo / simulation :</strong> aucun argent réel n&apos;est débité ni envoyé. Les dépôts sont crédités immédiatement,
            les retraits restent en attente de validation par un administrateur. Astuce : un numéro finissant par 0000 simule un refus.
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent md:col-span-1">
          <div className="text-sm text-slate-300">Solde F CFA</div>
          <div className="mt-1 text-4xl"><Money amount={me.fcfa} currency="fcfa" className="text-emerald-300" /></div>
          <div className="mt-4 flex gap-2">
            <ButtonLink href="/paris" className="px-4 py-2">⚽ Parier</ButtonLink>
            <ButtonLink href="/paris/mes-paris" variant="ghost" className="px-4 py-2">Mes paris</ButtonLink>
          </div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Lions</div>
          <div className="mt-1 text-2xl"><Money amount={me.lions} currency="lions" className="text-fuchsia-300" /></div>
          <div className="mt-2 text-xs text-slate-400">1 Lion = {config.FCFA_PER_LION.toLocaleString("fr-FR")} F CFA {isPro ? "" : "· conversion réservée aux joueurs Pro"}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Coris</div>
          <div className="mt-1 text-2xl"><Money amount={me.coris} currency="coris" className="text-amber-300" /></div>
          <div className="mt-2 text-xs text-slate-400">{config.CORIS_PER_LION} Coris = 1 Lion (page <Link href="/passer-pro" className="text-fuchsia-300">Niveau Pro</Link>)</div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-white/10 p-3">
          <Tabs
            value={tab}
            onChange={(t) => {
              setTab(t);
              setMsg(null);
            }}
            items={[
              { id: "depot" as const, label: "⬇️ Dépôt" },
              { id: "retrait" as const, label: "⬆️ Retrait" },
              { id: "convertir" as const, label: "🦁 Lions → F CFA" },
            ]}
          />
        </div>
        <div className="space-y-5 p-5">
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

          {tab !== "convertir" ? (
            <>
              <div>
                <div className="mb-2 text-sm text-slate-300">Opérateur Mobile Money</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {OPERATORS.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setOperator(o.id)}
                      className={cx(
                        "flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition",
                        operator === o.id ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-slate-900/60 hover:border-white/25",
                      )}
                    >
                      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-extrabold text-slate-950", o.color)}>{o.short}</span>
                      {o.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Numéro de téléphone</span>
                  <div className="flex">
                    <span className="flex items-center rounded-l-xl border border-r-0 border-white/10 bg-white/5 px-3 text-sm text-slate-400">+225</span>
                    <input type="tel" inputMode="tel" placeholder="07 07 07 07 07" value={phone} onChange={(e) => setPhone(e.target.value)} className={cx(inputClass, "rounded-l-none")} />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Montant (F CFA)</span>
                  <input type="number" min={min} max={max} step={100} value={Number.isFinite(amount) ? amount : ""} onChange={(e) => setAmount(parseInt(e.target.value, 10))} className={inputClass} />
                  <span className="mt-1 block text-xs text-slate-500">Entre {min.toLocaleString("fr-FR")} et {max.toLocaleString("fr-FR")} F CFA</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1000, 2000, 5000, 10000, 25000].filter((v) => v >= min && v <= max).map((v) => (
                  <button key={v} onClick={() => setAmount(v)} className={cx("rounded-lg px-3 py-1 text-xs", amount === v ? "bg-amber-400 text-slate-950" : "bg-white/5 hover:bg-white/10")}>
                    {v.toLocaleString("fr-FR")} F
                  </button>
                ))}
                {tab === "retrait" && me.fcfa >= min && (
                  <button onClick={() => setAmount(Math.min(max, Math.floor(me.fcfa)))} className="rounded-lg bg-white/5 px-3 py-1 text-xs hover:bg-white/10">Tout ({Math.min(max, Math.floor(me.fcfa)).toLocaleString("fr-FR")} F)</button>
                )}
              </div>
              {tab === "depot" ? (
                <Button className="w-full py-3 sm:w-auto" disabled={busy || !validAmount || phone.trim().length < 8} onClick={() => submit("deposit")}>
                  {busy ? "Paiement en cours…" : `Déposer ${validAmount ? amount.toLocaleString("fr-FR") : "…"} F CFA via ${operatorName(operator)}`}
                </Button>
              ) : (
                <Button className="w-full py-3 sm:w-auto" disabled={busy || !validAmount || phone.trim().length < 8 || amount > me.fcfa} onClick={() => submit("withdraw")}>
                  {amount > me.fcfa ? "Solde insuffisant" : busy ? "Envoi…" : `Demander le retrait de ${validAmount ? amount.toLocaleString("fr-FR") : "…"} F CFA`}
                </Button>
              )}
            </>
          ) : !isPro ? (
            <div className="space-y-3 text-sm text-slate-300">
              <p>La conversion des Lions en F CFA est réservée aux joueurs <strong className="text-fuchsia-300">Pro</strong>.</p>
              <ButtonLink href="/passer-pro" variant="pro">🦁 Passer au niveau Pro</ButtonLink>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Taux : <strong className="text-white">1 Lion = {config.FCFA_PER_LION.toLocaleString("fr-FR")} F CFA</strong>. Vous avez {maxLions} Lion(s) entier(s) convertible(s).
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1">
                  <span className="mb-1 block text-sm text-slate-300">Nombre de Lions</span>
                  <input type="number" min={1} max={Math.max(1, maxLions)} step={1} value={Number.isFinite(lions) ? lions : ""} onChange={(e) => setLions(parseInt(e.target.value, 10))} className={inputClass} />
                </label>
                <Button variant="pro" className="py-3" disabled={busy || !Number.isInteger(lions) || lions < 1 || lions > maxLions} onClick={() => submit("convert")}>
                  Recevoir {((Number.isFinite(lions) ? lions : 0) * config.FCFA_PER_LION).toLocaleString("fr-FR")} F CFA
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 5, 10, maxLions].filter((v, i, a) => v >= 1 && v <= maxLions && a.indexOf(v) === i).map((v) => (
                  <button key={v} onClick={() => setLions(v)} className="rounded-lg bg-white/5 px-3 py-1 text-xs hover:bg-white/10">
                    {v === maxLions ? `Max (${v})` : v}
                  </button>
                ))}
              </div>
              {maxLions < 1 && (
                <p className="text-xs text-slate-400">
                  Vous n&apos;avez pas de Lion. Gagnez des Coris au salon puis convertissez-les en Lions sur la page <Link href="/passer-pro" className="text-fuchsia-300">Niveau Pro</Link>.
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Dépôts et retraits</h2>
          {data.payments.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune opération Mobile Money pour l&apos;instant.</p>
          ) : (
            <div className="divide-y divide-white/5 text-sm">
              {data.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium">{p.kind === "depot" ? "⬇️ Dépôt" : "⬆️ Retrait"} · {operatorName(p.operator)}</div>
                    <div className="truncate text-xs text-slate-500">{formatPhone(p.phone)} · {fmtDate(p.createdAt)}{p.providerRef ? ` · ${p.providerRef}` : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className={cx("font-semibold tabular-nums", p.kind === "depot" ? "text-emerald-300" : "text-slate-200")}>
                      {p.kind === "depot" ? "+" : "-"}{p.amount.toLocaleString("fr-FR")} F
                    </div>
                    <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-semibold", PAY_STATUS[p.status].cls)}>{PAY_STATUS[p.status].label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Historique F CFA</h2>
          {data.transactions.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun mouvement pour l&apos;instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <tbody className="divide-y divide-white/5">
                  {data.transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 pr-2 text-xs text-slate-400">{fmtDate(t.createdAt)}</td>
                      <td className="pr-2">
                        {t.matchId ? <Link href={`/paris/match/${idParam(t.matchId)}`} className="hover:text-amber-200">{t.label}</Link> : t.label}
                      </td>
                      <td className={cx("whitespace-nowrap text-right", t.amount >= 0 ? "text-emerald-300" : "text-rose-300")}>
                        <Money amount={t.amount} currency={t.currency} signed />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
