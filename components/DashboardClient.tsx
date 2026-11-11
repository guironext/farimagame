"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { GAMES, modeLabel } from "@/lib/games/meta";
import { ROLE_LABEL, type TableView, type TxView } from "@/lib/types";
import { useSession } from "./SessionProvider";
import { Alert, ButtonLink, Card, Money, PageTitle, Spinner, cx, useRequireAuth } from "./ui";

interface WalletData {
  transactions: TxView[];
  stats: { played: number; wins: number; draws: number; losses: number };
}

export function DashboardClient() {
  const { me, loading } = useRequireAuth();
  const { refresh } = useSession();
  const [data, setData] = useState<WalletData | null>(null);
  const [tables, setTables] = useState<TableView[]>([]);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWelcome(new URLSearchParams(window.location.search).has("bienvenue"));
  }, []);

  useEffect(() => {
    if (!me) return;
    refresh();
    api<WalletData>("/api/wallet").then(setData).catch(() => {});
    api<{ mine: TableView[] }>("/api/tables").then((r) => setTables(r.mine)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  if (loading || !me) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageTitle title={`Bonjour ${me.username} 👋`} subtitle="Votre tableau de bord de joueur" />
      {welcome && <Alert kind="success">Bienvenue ! 500 Coris ont été crédités sur votre compte. Bonne partie !</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-amber-400/20 bg-gradient-to-br from-amber-500/15 to-transparent">
          <div className="text-sm text-slate-400">Solde Coris</div>
          <div className="mt-1 text-3xl"><Money amount={me.coris} currency="coris" className="text-amber-300" /></div>
        </Card>
        <Card className="border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/15 to-transparent">
          <div className="text-sm text-slate-400">Solde Lions</div>
          <div className="mt-1 text-3xl"><Money amount={me.lions} currency="lions" className="text-fuchsia-300" /></div>
          {me.level !== "pro" && <Link href="/passer-pro" className="mt-2 inline-block text-xs text-fuchsia-300">Passer Pro pour obtenir des Lions →</Link>}
        </Card>
        <Card className="border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 to-transparent">
          <div className="text-sm text-slate-400">Solde F CFA</div>
          <div className="mt-1 text-3xl"><Money amount={me.fcfa} currency="fcfa" className="text-emerald-300" /></div>
          <Link href="/portefeuille" className="mt-2 inline-block text-xs text-emerald-300">Déposer · Retirer · Convertir →</Link>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Niveau · Rôle</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={cx("rounded-full px-3 py-1 text-sm font-bold", me.level === "pro" ? "bg-fuchsia-500/20 text-fuchsia-200" : "bg-amber-500/20 text-amber-200")}>
              {me.level === "pro" ? "🦁 PRO" : "🐚 NORMAL"}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{ROLE_LABEL[me.role]}</span>
          </div>
          {data && (
            <div className="mt-3 text-xs text-slate-400">
              {data.stats.played} parties · {data.stats.wins} victoires · {data.stats.draws} nuls · {data.stats.losses} défaites
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/salon">🎮 Jouer maintenant</ButtonLink>
        <ButtonLink href="/paris" variant="ghost">⚽ Paris sportifs</ButtonLink>
        <ButtonLink href="/passer-pro" variant="pro">🦁 Niveau Pro & conversion</ButtonLink>
      </div>

      {tables.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Mes parties récentes</h2>
          <div className="divide-y divide-white/5 text-sm">
            {tables.slice(0, 10).map((t) => {
              const won = t.status === "finished" && t.winnerSeat === t.mySeat;
              return (
                <Link key={t.id} href={`/jeu/${t.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-amber-200">
                  <span>
                    {GAMES[t.game].emoji} {GAMES[t.game].name} · <span className="text-slate-400">{modeLabel(t.mode)}</span>
                  </span>
                  <span className={cx("text-xs", t.status === "finished" ? (won ? "text-emerald-300" : t.isDraw ? "text-sky-300" : "text-rose-300") : "text-amber-300")}>
                    {t.status === "finished" ? (won ? "Gagnée" : t.isDraw ? "Nul" : "Perdue") : t.status === "playing" ? "En cours" : "En attente"}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-semibold">Historique des transactions</h2>
        {!data ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Opération</th>
                  <th className="text-right">Montant</th>
                  <th className="text-right">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 text-slate-400">{fmtDate(t.createdAt)}</td>
                    <td>
                      {t.tableId ? (
                        <Link href={`/jeu/${t.tableId}`} className="hover:text-amber-200">{t.label}</Link>
                      ) : t.matchId ? (
                        <Link href={`/paris/match/${encodeURIComponent(t.matchId)}`} className="hover:text-amber-200">{t.label}</Link>
                      ) : (
                        t.label
                      )}
                    </td>
                    <td className={cx("text-right", t.amount >= 0 ? "text-emerald-300" : "text-rose-300")}>
                      <Money amount={t.amount} currency={t.currency} signed />
                    </td>
                    <td className="text-right text-slate-300">
                      <Money amount={t.balanceAfter} currency={t.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
