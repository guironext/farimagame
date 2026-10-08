"use client";

import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import type { Currency } from "@/lib/types";
import { AdminOnly, Card, Money, PageTitle, Spinner, cx, useRequireAuth } from "./ui";

interface HouseData {
  balances: { coris: number; lions: number; fcfa: number };
  commissions: { coris: number; lions: number; fcfa: number };
  players: number;
  tables: { playing: number; finished: number };
  ledger: { id: string; type: string; currency: Currency; amount: number; label: string; createdAt: string }[];
}

export function HouseClient() {
  const { me, loading } = useRequireAuth();
  const [data, setData] = useState<HouseData | null>(null);
  useEffect(() => {
    if (me?.role === "ADMIN") api<HouseData>("/api/house").then(setData).catch(() => {});
  }, [me]);
  if (!loading && me && me.role !== "ADMIN") return <AdminOnly />;
  if (loading || !me || !data) return <Spinner />;
  return (
    <div className="space-y-6">
      <PageTitle title="🏦 La Maison" subtitle="Caisse de la plateforme : commissions de 20 % (jeux et paris sportifs) et résultats des parties contre l'ordinateur." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <div className="text-sm text-slate-400">Commissions Coris</div>
          <div className="mt-1 text-2xl"><Money amount={data.commissions.coris} currency="coris" className="text-amber-300" /></div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Commissions Lions</div>
          <div className="mt-1 text-2xl"><Money amount={data.commissions.lions} currency="lions" className="text-fuchsia-300" /></div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Commissions paris (F CFA)</div>
          <div className="mt-1 text-2xl"><Money amount={data.commissions.fcfa} currency="fcfa" className="text-emerald-300" /></div>
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
