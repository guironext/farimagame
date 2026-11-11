"use client";

import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { operatorName } from "@/lib/payments/types";
import { canManageMoney, type Currency, type PaymentView } from "@/lib/types";
import { AdminOnly, Button, Card, Money, PageTitle, Spinner, cx, useRequireAuth } from "./ui";

interface HouseData {
  balances: { coris: number; lions: number; fcfa: number };
  commissions: { coris: number; lions: number; fcfa: number };
  players: number;
  tables: { playing: number; finished: number };
  ledger: { id: string; type: string; currency: Currency; amount: number; label: string; createdAt: string }[];
  withdrawals: PaymentView[];
}

export function HouseClient() {
  const { me, loading } = useRequireAuth();
  const [data, setData] = useState<HouseData | null>(null);
  const [busy, setBusy] = useState(false);
  function load() {
    api<HouseData>("/api/house").then(setData).catch(() => {});
  }
  useEffect(() => {
    if (me && canManageMoney(me.role)) load();
  }, [me]);
  async function decide(paymentId: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      await api("/api/house", { action: "withdrawal", paymentId, decision });
      load();
    } finally {
      setBusy(false);
    }
  }
  if (!loading && me && !canManageMoney(me.role)) return <AdminOnly />;
  if (loading || !me || !data) return <Spinner />;
  const pending = data.withdrawals.filter((p) => p.status === "pending");
  return (
    <div className="space-y-6">
      <PageTitle title="🏦 La Maison" subtitle="Caisse de la plateforme : commissions de 20 % sur les parties et résultats contre l'ordinateur." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-sm text-slate-400">Commissions Coris</div>
          <div className="mt-1 text-2xl"><Money amount={data.commissions.coris} currency="coris" className="text-amber-300" /></div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Commissions Lions</div>
          <div className="mt-1 text-2xl"><Money amount={data.commissions.lions} currency="lions" className="text-fuchsia-300" /></div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Résultat net</div>
          <div className="mt-1 flex flex-col text-lg">
            <Money amount={data.balances.coris} currency="coris" />
            <Money amount={data.balances.lions} currency="lions" />
            <Money amount={data.balances.fcfa} currency="fcfa" />
          </div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Activité</div>
          <div className="mt-1 text-sm">{data.players} joueurs · {data.tables.playing} parties en cours · {data.tables.finished} terminées</div>
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Retraits F CFA {pending.length > 0 ? `(${pending.length} en attente)` : ""}</h2>
        {data.withdrawals.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune demande de retrait.</p>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {data.withdrawals.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">{p.username ?? "Joueur"} · {operatorName(p.operator)}</div>
                  <div className="text-xs text-slate-500">{p.phone} · {fmtDate(p.createdAt)} · {p.status}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{p.amount.toLocaleString("fr-FR")} F</span>
                  {p.status === "pending" && (
                    <>
                      <Button disabled={busy} onClick={() => decide(p.id, "approve")}>Valider</Button>
                      <Button variant="danger" disabled={busy} onClick={() => decide(p.id, "reject")}>Refuser</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Mouvements récents</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <tbody className="divide-y divide-white/5">
              {data.ledger.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 text-slate-400">{fmtDate(l.createdAt)}</td>
                  <td>{l.label}</td>
                  <td className={cx("text-right", l.amount >= 0 ? "text-emerald-300" : "text-rose-300")}>
                    <Money amount={l.amount} currency={l.currency} signed />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.ledger.length === 0 && <p className="text-sm text-slate-400">Aucun mouvement pour l&apos;instant.</p>}
        </div>
      </Card>
    </div>
  );
}
