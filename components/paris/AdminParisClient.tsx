"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MARKET_BY_ID, selectionLabel } from "@/lib/betting";
import { api, fmtDate, idParam } from "@/lib/client";
import { formatPhone, operatorName } from "@/lib/payments/types";
import type { MarketId, MatchView, PaymentView, Selection } from "@/lib/types";
import { AdminOnly, Alert, Button, Card, Money, PageTitle, Spinner, Tabs, cx, useRequireAuth } from "../ui";
import { DemoBanner, StatusBadge } from "./shared";

interface AdminMatch extends MatchView {
  betsCount: number;
  commission: number;
  settlement: Partial<Record<MarketId, { winner: Selection | null; pool: number; commission: number; refunded: boolean; reason?: string }>> | null;
}

interface AdminData {
  provider: {
    id: string;
    label: string;
    isDemo: boolean;
    lastSyncAt: string | null;
    lastError: string | null;
    odds?: { enabled: boolean; provider: string; status: string; fetchedAt: string | null; nextAt: string | null; remaining: number | null; events: number; lastError: string | null };
  };
  stats: { commission: number; houseFcfa: number; pendingStakes: number; pendingBets: number; totalBets: number; deposits: number; withdrawals: number };
  matches: AdminMatch[];
  payments: PaymentView[];
}

type Tab = "bets" | "all" | "withdrawals";

export function AdminParisClient() {
  const { me, loading } = useRequireAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<Tab>("bets");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = me?.role === "ADMIN";
  const load = useCallback(() => api<AdminData>("/api/admin/paris").then(setData).catch((e) => setMsg({ kind: "error", text: (e as Error).message })), []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [isAdmin, load]);

  if (!loading && me && !isAdmin) return <AdminOnly />;
  if (loading || !me || !data) return <Spinner />;

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/admin/paris", body);
      setMsg({ kind: "success", text: ok });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const pendingWithdrawals = data.payments.filter((p) => p.kind === "retrait" && p.status === "pending");
  const list = tab === "bets" ? data.matches.filter((m) => m.betsCount > 0) : data.matches;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle title="🛠️ Administration des paris" subtitle="Suivi des pots, règlement des matchs, commission de la maison et demandes de retrait." />
        <Link href="/maison" className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">🏦 La Maison (caisse)</Link>
      </div>
      {data.provider.isDemo && (
        <DemoBanner>
          Source : <strong>{data.provider.label}</strong>. Les matchs démo reçoivent un score fictif 2 h après le coup d&apos;envoi (règlement automatique). Vous pouvez aussi
          fixer le score vous-même à tout moment pour régler un match immédiatement.
        </DemoBanner>
      )}
      {data.provider.lastError && <Alert>Erreur de synchronisation : {data.provider.lastError}</Alert>}
      {data.provider.odds && (
        <div className="rounded-xl border border-line bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          <div>
            Cotes de référence : <strong>{data.provider.odds.provider}</strong> · {data.provider.odds.status}
          </div>
          {data.provider.odds.enabled && (
            <div className="mt-1 text-xs text-slate-400">
              {data.provider.odds.fetchedAt ? `Dernière mise à jour : ${fmtDate(data.provider.odds.fetchedAt)}` : "Pas encore de mise à jour"}
              {data.provider.odds.nextAt ? ` · prochaine : ${fmtDate(data.provider.odds.nextAt)}` : ""}
              {data.provider.odds.remaining != null ? ` · crédits restants : ${data.provider.odds.remaining}` : ""}
            </div>
          )}
          {data.provider.odds.lastError && <div className="mt-1 text-xs text-rose-300">Erreur The Odds API : {data.provider.odds.lastError}</div>}
        </div>
      )}
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 to-transparent">
          <div className="text-sm text-slate-400">Commission paris (10 %)</div>
          <div className="mt-1 text-2xl"><Money amount={data.stats.commission} currency="fcfa" className="text-emerald-300" /></div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Mises en jeu</div>
          <div className="mt-1 text-2xl"><Money amount={data.stats.pendingStakes} currency="fcfa" className="text-amber-300" /></div>
          <div className="text-xs text-slate-500">{data.stats.pendingBets} pari(s) en cours · {data.stats.totalBets} au total</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Dépôts (simulés)</div>
          <div className="mt-1 text-2xl"><Money amount={data.stats.deposits} currency="fcfa" /></div>
        </Card>
        <Card>
          <div className="text-sm text-slate-400">Retraits versés</div>
          <div className="mt-1 text-2xl"><Money amount={data.stats.withdrawals} currency="fcfa" /></div>
          <div className="text-xs text-slate-500">{pendingWithdrawals.length} demande(s) en attente</div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: "bets" as const, label: `Matchs avec paris (${data.matches.filter((m) => m.betsCount > 0).length})` },
            { id: "all" as const, label: `Tous les matchs (${data.matches.length})` },
            { id: "withdrawals" as const, label: `Retraits (${pendingWithdrawals.length})` },
          ]}
        />
        <Button variant="ghost" disabled={busy} onClick={() => act({ action: "sync" }, "Matchs synchronisés.")}>
          🔄 Synchroniser {data.provider.lastSyncAt ? <span className="text-xs text-slate-400">(dernière : {fmtDate(data.provider.lastSyncAt)})</span> : null}
        </Button>
      </div>

      {tab === "withdrawals" ? (
        <Card>
          {data.payments.filter((p) => p.kind === "retrait").length === 0 ? (
            <p className="text-sm text-slate-400">Aucune demande de retrait.</p>
          ) : (
            <div className="divide-y divide-white/5 text-sm">
              {data.payments
                .filter((p) => p.kind === "retrait")
                .map((p) => (
                  <div key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">
                        {p.username} · {p.amount.toLocaleString("fr-FR")} F CFA · {operatorName(p.operator)}
                      </div>
                      <div className="text-xs text-slate-500">{formatPhone(p.phone)} · {fmtDate(p.createdAt)} · {p.providerRef}</div>
                    </div>
                    {p.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button disabled={busy} onClick={() => act({ action: "withdrawal", paymentId: p.id, decision: "approve" }, "Retrait validé.")}>Valider</Button>
                        <Button variant="danger" disabled={busy} onClick={() => act({ action: "withdrawal", paymentId: p.id, decision: "reject" }, "Retrait refusé, montant restitué.")}>Refuser</Button>
                      </div>
                    ) : (
                      <span className={cx("text-xs font-semibold", p.status === "completed" ? "text-emerald-300" : "text-rose-300")}>
                        {p.status === "completed" ? "Effectué" : p.status === "rejected" ? "Refusé" : "Échoué"}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </Card>
      ) : list.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-400">Aucun match avec des paris pour l&apos;instant.</Card>
      ) : (
        <div className="space-y-3">
          {list.map((m) => (
            <AdminMatchRow key={m.id} m={m} busy={busy} act={act} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminMatchRow({ m, busy, act }: { m: AdminMatch; busy: boolean; act: (b: Record<string, unknown>, ok: string) => Promise<void> }) {
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const label = `${m.home} - ${m.away}`;
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{m.competition.flag} {m.competition.name}</span>·<span>{fmtDate(m.kickoff)}</span>
            <StatusBadge status={m.status} />
            {m.source === "manuel" && <span className="rounded bg-white/10 px-1.5 text-[10px]">résultat manuel</span>}
          </div>
          <Link href={`/paris/match/${idParam(m.id)}`} className="mt-1 block truncate font-semibold hover:text-amber-200">
            {label} {m.score && <span className="ml-2 tabular-nums text-amber-300">{m.score.home} - {m.score.away}</span>}
          </Link>
          <div className="mt-1 text-xs text-slate-400">
            Pot : <strong className="text-slate-200">{m.totalPool.toLocaleString("fr-FR")} F</strong> · {m.betsCount} pari(s)
            {m.settled && <> · Commission : <strong className="text-emerald-300">{m.commission.toLocaleString("fr-FR")} F</strong></>}
          </div>
        </div>
        {!m.settled ? (
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" min={0} max={30} value={home} onChange={(e) => setHome(parseInt(e.target.value, 10) || 0)} className="w-14 rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-center" aria-label="Buts domicile" />
            <span>-</span>
            <input type="number" min={0} max={30} value={away} onChange={(e) => setAway(parseInt(e.target.value, 10) || 0)} className="w-14 rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-center" aria-label="Buts extérieur" />
            <Button disabled={busy} onClick={() => confirm(`Régler ${label} sur le score ${home}-${away} ?`) && act({ action: "result", matchId: m.id, status: "finished", home, away }, `Match réglé : ${label} ${home}-${away}.`)}>
              Régler
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => confirm(`Déclarer ${label} reporté et rembourser ?`) && act({ action: "result", matchId: m.id, status: "postponed" }, "Match reporté : paris remboursés.")}>
              Reporté
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => confirm(`Annuler ${label} et rembourser ?`) && act({ action: "result", matchId: m.id, status: "cancelled" }, "Match annulé : paris remboursés.")}>
              Annulé
            </Button>
          </div>
        ) : (
          <span className="text-xs font-semibold text-emerald-300">✅ Réglé</span>
        )}
      </div>
      {m.settlement && m.totalPool > 0 && (
        <div className="mt-3 grid gap-2 border-t border-white/5 pt-3 text-xs sm:grid-cols-3">
          {(Object.keys(m.settlement) as MarketId[])
            .filter((k) => (m.settlement![k]?.pool ?? 0) > 0)
            .map((k) => {
              const s = m.settlement![k]!;
              return (
                <div key={k} className="rounded-lg bg-white/5 p-2">
                  <div className="font-semibold">{MARKET_BY_ID[k].short}</div>
                  <div className="text-slate-400">Pot {s.pool.toLocaleString("fr-FR")} F · {s.winner ? `issue : ${selectionLabel(k, s.winner, m.home, m.away)}` : "—"}</div>
                  <div className={s.refunded ? "text-sky-300" : "text-emerald-300"}>{s.refunded ? s.reason ?? "Remboursé" : `Commission ${s.commission.toLocaleString("fr-FR")} F`}</div>
                </div>
              );
            })}
        </div>
      )}
    </Card>
  );
}
