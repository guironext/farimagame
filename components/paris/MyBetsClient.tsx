"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, fmtDate, idParam } from "@/lib/client";
import type { BetStatus, BetView } from "@/lib/types";
import { useSession } from "../SessionProvider";
import { ButtonLink, Card, Money, PageTitle, Spinner, cx, useRequireAuth } from "../ui";
import { StatusBadge } from "./shared";

const TABS: { id: BetStatus; label: string; emoji: string }[] = [
  { id: "pending", label: "En cours", emoji: "⏳" },
  { id: "won", label: "Gagnés", emoji: "🏆" },
  { id: "lost", label: "Perdus", emoji: "❌" },
  { id: "refunded", label: "Remboursés", emoji: "↩️" },
];

export function BetStatusBadge({ bet }: { bet: BetView }) {
  const s = {
    pending: "text-amber-300",
    won: "text-emerald-300",
    lost: "text-rose-300",
    refunded: "text-sky-300",
  }[bet.status];
  const text = {
    pending: bet.estimatedPayout != null ? `en cours · gain estimé ~${bet.estimatedPayout.toLocaleString("fr-FR")} F` : "en cours",
    won: `gagné · +${bet.payout.toLocaleString("fr-FR")} F`,
    lost: "perdu",
    refunded: `remboursé · ${bet.payout.toLocaleString("fr-FR")} F`,
  }[bet.status];
  return <span className={cx("text-xs font-semibold", s)}>{text}</span>;
}

export function MyBetsClient() {
  const { me, loading } = useRequireAuth();
  const { refresh } = useSession();
  const [bets, setBets] = useState<BetView[] | null>(null);
  const [tab, setTab] = useState<BetStatus>("pending");
  const [autoTab, setAutoTab] = useState(false);

  useEffect(() => {
    if (!me) return;
    const load = () => api<{ bets: BetView[] }>("/api/paris/bets").then((r) => setBets(r.bets)).catch(() => {});
    load();
    refresh();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const stats = useMemo(() => {
    const list = bets ?? [];
    const sum = (f: (b: BetView) => number) => list.reduce((a, b) => a + f(b), 0);
    return {
      staked: sum((b) => b.stake),
      won: sum((b) => (b.status === "won" ? b.payout : 0)),
      pending: sum((b) => (b.status === "pending" ? b.stake : 0)),
      count: Object.fromEntries(TABS.map((t) => [t.id, list.filter((b) => b.status === t.id).length])) as Record<BetStatus, number>,
    };
  }, [bets]);

  if (bets && !autoTab) {
    // au premier chargement, ouvrir le premier onglet non vide
    const first = TABS.find((t) => bets.some((b) => b.status === t.id));
    setAutoTab(true);
    if (first && first.id !== tab) setTab(first.id);
  }

  if (loading || !me || !bets) return <Spinner />;
  const list = bets.filter((b) => b.status === tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle title="🎫 Mes paris" subtitle="Suivez vos paris sportifs en F CFA." />
        <ButtonLink href="/paris" className="mb-6">⚽ Parier sur un match</ButtonLink>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-sm text-slate-400">Solde</div>
          <div className="mt-1 text-2xl"><Money amount={me.fcfa} currency="fcfa" className="text-emerald-300" /></div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Total misé</div>
          <div className="mt-1 text-2xl"><Money amount={stats.staked} currency="fcfa" /></div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Total gagné</div>
          <div className="mt-1 text-2xl"><Money amount={stats.won} currency="fcfa" className="text-emerald-300" /></div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Mises en jeu</div>
          <div className="mt-1 text-2xl"><Money amount={stats.pending} currency="fcfa" className="text-amber-300" /></div>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium",
              tab === t.id ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
            )}
          >
            {t.emoji} {t.label} <span className="ml-1 rounded-full bg-white/10 px-2 text-xs">{stats.count[t.id]}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card className="py-12 text-center text-slate-400">Aucun pari dans cette catégorie.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((b) => (
            <Link key={b.id} href={`/paris/match/${idParam(b.matchId)}`}>
              <Card className="h-full p-4 transition hover:border-white/20">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="truncate">{b.match.competition}</span>
                  <StatusBadge status={b.match.status} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    {b.match.home} - {b.match.away}
                  </span>
                  {b.match.score && <span className="shrink-0 font-bold tabular-nums">{b.match.score.home} - {b.match.score.away}</span>}
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500">{b.marketLabel}</div>
                    <div className="font-medium text-amber-200">{b.selectionLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm tabular-nums">Mise : {b.stake.toLocaleString("fr-FR")} F</div>
                    <BetStatusBadge bet={b} />
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Pari du {fmtDate(b.createdAt)} · match le {fmtDate(b.match.kickoff)}
                  {b.note && <span className="block text-sky-300/80">{b.note}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
