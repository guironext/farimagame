"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { INACTIVITY_CLAIM_MS } from "@/lib/config";
import { api } from "@/lib/client";
import { GAMES, modeLabel } from "@/lib/games/meta";
import type { TableView } from "@/lib/types";
import { AwaleBoard } from "./games/AwaleBoard";
import { ChessBoard } from "./games/ChessBoard";
import { DamesBoard } from "./games/DamesBoard";
import { LudoBoard } from "./games/LudoBoard";
import { useSession } from "./SessionProvider";
import { Alert, Button, Card, Money, Spinner, cx, useRequireAuth } from "./ui";

export function GameClient({ id }: { id: string }) {
  const { me, loading } = useRequireAuth();
  const { refresh } = useSession();
  const router = useRouter();
  const [table, setTable] = useState<TableView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastStatus = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ table: TableView }>(`/api/tables/${id}`);
      setTable(r.table);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(() => {
      setNow(Date.now());
      load();
    }, 1500);
    return () => clearInterval(t);
  }, [me, load]);

  // rafraîchir les soldes quand la partie se termine ou démarre
  useEffect(() => {
    if (table && lastStatus.current !== table.status) {
      if (lastStatus.current !== null) refresh();
      lastStatus.current = table.status;
    }
  }, [table, refresh]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ table: TableView }>(`/api/tables/${id}`, body);
      setTable(r.table);
      if (body.action !== "move") refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function replay() {
    if (!table) return;
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/tables", { game: table.game, mode: table.mode, currency: table.currency });
      await refresh();
      router.push(`/jeu/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !me) return <Spinner />;
  if (!table) return error ? <Alert>{error}</Alert> : <Spinner label="Chargement de la table…" />;

  const meta = GAMES[table.game];
  const mySeat = table.mySeat;
  const playing = table.status === "playing";
  const myTurn = playing && mySeat != null && table.currentSeat === mySeat && table.seats[mySeat]?.active;
  const curSeat = table.currentSeat != null ? table.seats[table.currentSeat] : null;
  const idle = table.lastMoveAt ? now - new Date(table.lastMoveAt).getTime() : 0;
  const canClaim = playing && mySeat != null && curSeat && !curSeat.isCpu && table.currentSeat !== mySeat && idle > INACTIVITY_CLAIM_MS;
  const iWon = table.status === "finished" && table.winnerSeat != null && table.winnerSeat === mySeat;
  const boardProps = { table, mySeat, canPlay: !!myTurn, busy, onMove: (move: unknown) => act({ action: "move", move }) };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.color} text-2xl`}>{meta.emoji}</div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">{meta.name}</h1>
            <p className="text-sm text-slate-400">
              {modeLabel(table.mode)} · Mise <Money amount={table.stake} currency={table.currency} /> · Pot{" "}
              <Money amount={table.pot} currency={table.currency} className="text-amber-300" />
            </p>
          </div>
        </div>
        <Link href="/salon" className="text-sm text-slate-400 hover:text-white">
          ← Retour au salon
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div>
          {table.status === "waiting" && (
            <Card className="py-12 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
              <h2 className="text-lg font-bold">En attente de joueurs…</h2>
              <p className="mt-1 text-sm text-slate-400">
                {table.seats.length}/{table.maxPlayers} joueurs. La partie démarre automatiquement quand la table est complète.
              </p>
              <p className="mt-3 text-xs text-slate-500">Partagez cette page à vos amis (ils doivent être connectés) ou attendez qu&apos;un joueur rejoigne depuis le salon.</p>
              {mySeat == null ? (
                <Button className="mt-6" disabled={busy} onClick={() => act({ action: "join" })}>
                  Rejoindre (mise <Money amount={table.stake} currency={table.currency} />)
                </Button>
              ) : (
                <Button variant="ghost" className="mt-6" disabled={busy} onClick={() => act({ action: "leave" })}>
                  Quitter la table (mise remboursée)
                </Button>
              )}
            </Card>
          )}
          {table.status === "cancelled" && <Alert kind="info">Cette table a été annulée.</Alert>}
          {(table.status === "playing" || table.status === "finished") && table.state != null && (
            <>
              {table.game === "awale" && <AwaleBoard {...boardProps} state={table.state as never} />}
              {table.game === "dames" && <DamesBoard {...boardProps} state={table.state as never} />}
              {table.game === "echecs" && <ChessBoard {...boardProps} state={table.state as never} />}
              {table.game === "ludo" && <LudoBoard {...boardProps} state={table.state as never} />}
            </>
          )}
        </div>

        <div className="space-y-4">
          {table.status === "finished" && (
            <Card className={cx("text-center", iWon ? "border-emerald-400/40 bg-emerald-500/10" : table.isDraw ? "border-sky-400/40" : "border-rose-400/30")}>
              <div className="text-4xl">{iWon ? "🏆" : table.isDraw ? "🤝" : "😔"}</div>
              <h2 className="mt-2 text-lg font-bold">
                {iWon ? "Victoire !" : table.isDraw ? "Match nul" : `${table.seats[table.winnerSeat ?? 0]?.username} a gagné`}
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                {table.isDraw ? (
                  <>Chaque joueur reçoit <Money amount={table.payout} currency={table.currency} /></>
                ) : (
                  <>Gain : <Money amount={table.payout} currency={table.currency} className="text-emerald-300" /> (80 % du pot)</>
                )}
              </p>
              <p className="text-xs text-slate-500">
                Commission maison : <Money amount={table.commission} currency={table.currency} />
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button onClick={replay} disabled={busy}>
                  Rejouer ({table.stake} {table.currency === "coris" ? "Coris" : "Lion(s)"})
                </Button>
                <Link href="/salon" className="text-sm text-slate-400 hover:text-white">
                  Retour au salon
                </Link>
              </div>
            </Card>
          )}

          <Card>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Joueurs</h3>
            <ul className="space-y-2">
              {Array.from({ length: table.maxPlayers }).map((_, i) => {
                const s = table.seats[i];
                const isTurn = playing && table.currentSeat === i;
                return (
                  <li key={i} className={cx("flex items-center justify-between rounded-xl px-3 py-2 text-sm", isTurn ? "bg-amber-400/15 ring-1 ring-amber-400/50" : "bg-white/5")}>
                    <span className={cx(!s?.active && s && "line-through opacity-60")}>
                      {s ? (s.isCpu ? "🤖 " : "👤 ") + s.username : <em className="text-slate-500">Place libre</em>}
                      {s && s.seat === mySeat && <span className="ml-1 text-xs text-amber-300">(vous)</span>}
                    </span>
                    {isTurn && <span className="text-xs font-semibold text-amber-300">à jouer</span>}
                    {table.status === "finished" && table.winnerSeat === i && <span>🏆</span>}
                  </li>
                );
              })}
            </ul>
            {playing && (
              <p className="mt-3 text-center text-sm">
                {myTurn ? (
                  <span className="font-semibold text-emerald-300">C&apos;est à vous de jouer !</span>
                ) : (
                  <span className="text-slate-400">En attente de {curSeat?.username ?? "…"}</span>
                )}
              </p>
            )}
            {playing && mySeat != null && table.seats[mySeat]?.active && (
              <div className="mt-4 flex flex-col gap-2">
                {canClaim && (
                  <Button variant="ghost" disabled={busy} onClick={() => act({ action: "claim" })}>
                    Réclamer la victoire (adversaire inactif)
                  </Button>
                )}
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Abandonner la partie ? Votre mise sera perdue.")) act({ action: "resign" });
                  }}
                >
                  Abandonner
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Journal</h3>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-slate-300">
              {[...table.log].reverse().map((l, i) => (
                <li key={i} className={cx(i === 0 && "text-white")}>
                  • {l}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
