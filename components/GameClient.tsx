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
import { RaceBoard } from "./games/RaceBoard";
import { RunBoard } from "./games/RunBoard";
import { VictoryConfetti } from "./VictoryConfetti";
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
  const [guest, setGuest] = useState("");
  const [roster, setRoster] = useState<{ id: string; username: string; level: string }[]>([]);
  const [cheer, setCheer] = useState<string | null>(null);
  const lastStatus = useRef<string | null>(null);
  const cheered = useRef<string | null>(null);

  const adopt = useCallback((next: TableView) => {
    setTable((prev) => (prev && prev.version >= next.version ? prev : next));
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api<{ table: TableView }>(`/api/tables/${id}`);
      adopt(r.table);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, adopt]);

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

  useEffect(() => {
    if (!table || table.status !== "finished" || table.isDraw || table.winnerSeat == null) return;
    const name = table.seats[table.winnerSeat]?.username;
    if (!name || cheered.current === table.id) return;
    cheered.current = table.id;
    setCheer(name);
  }, [table]);

  // rafraîchir les soldes quand la partie se termine ou démarre
  useEffect(() => {
    if (table && lastStatus.current !== table.status) {
      if (lastStatus.current !== null) refresh();
      lastStatus.current = table.status;
    }
  }, [table, refresh]);

  useEffect(() => {
    if (!me || !table || table.mode === "cpu" || table.status !== "waiting" || table.createdBy !== me.id) return;
    let cancel = false;
    api<{ players: { id: string; username: string; level: string }[] }>(`/api/joueurs?currency=${table.currency}`)
      .then((r) => {
        if (!cancel) setRoster(r.players);
      })
      .catch(() => {
        if (!cancel) setRoster([]);
      });
    return () => {
      cancel = true;
    };
  }, [me, table]);

  useEffect(() => {
    if (!me || !table || table.mySeat == null || table.status !== "playing") return;
    if (table.game !== "ludo" && table.game !== "dames" && table.game !== "awale" && table.game !== "echecs" && table.game !== "run" && table.game !== "course") return;
    const cur = table.currentSeat != null ? table.seats[table.currentSeat] : null;
    if (!cur?.isCpu) return;
    const elapsed = Date.now() - new Date(table.lastMoveAt ?? table.startedAt ?? table.createdAt).getTime();
    const wait = Math.max(400, 1100 - elapsed);
    let cancelled = false;
    const timer = setTimeout(() => {
      api<{ table: TableView }>(`/api/tables/${id}`, { action: "cpu" })
        .then((r) => {
          if (!cancelled) adopt(r.table);
        })
        .catch((e) => {
          if (!cancelled) setError((e as Error).message);
        });
    }, wait);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [me, id, table, adopt]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ table: TableView }>(`/api/tables/${id}`, body);
      adopt(r.table);
      if (body.action !== "move") refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function replay() {
    if (!table) return;
    if (table.mode !== "cpu") {
      router.push(`/salon?jeu=${table.game}`);
      return;
    }
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
  const courseState = table.game === "course" ? (table.state as { over?: boolean; scores?: (unknown | null)[] }) : null;
  const courseCanPlay = playing && mySeat != null && !!table.seats[mySeat]?.active && !!courseState && !courseState.over && courseState.scores?.[mySeat] == null;
  const curSeat = table.currentSeat != null ? table.seats[table.currentSeat] : null;
  const idle = table.lastMoveAt ? now - new Date(table.lastMoveAt).getTime() : 0;
  const canClaim = playing && mySeat != null && curSeat && !curSeat.isCpu && table.currentSeat !== mySeat && idle > INACTIVITY_CLAIM_MS;
  const iWon = table.status === "finished" && table.winnerSeat != null && table.winnerSeat === mySeat;
  const invites = table.invites ?? [];
  const invitedTable = invites.length > 0;
  const myInvite = invites.find((i) => i.userId === me.id);
  const isHost = table.createdBy === me.id;
  const pendingInvites = invites.filter((i) => i.status === "pending").length;
  const canInviteMore = isHost && table.status === "waiting" && pendingInvites < table.maxPlayers - table.seats.length;
  const boardProps = { table, mySeat, canPlay: !!myTurn, busy, onMove: (move: unknown) => act({ action: "move", move }) };

  const winnerName =
    table.status === "finished" && !table.isDraw && table.winnerSeat != null ? table.seats[table.winnerSeat]?.username : null;

  return (
    <div className="space-y-5">
      {cheer && winnerName && <VictoryConfetti name={winnerName} onDone={() => setCheer(null)} />}
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
            <Card className="py-10 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
              <h2 className="text-lg font-bold">{invitedTable ? "En attente des acceptations" : "En attente de joueurs…"}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {table.seats.length}/{table.maxPlayers} joueurs. Le plateau apparaît quand la table est complète. Le vainqueur remporte 80 % du pot.
              </p>
              {invitedTable && (
                <ul className="mx-auto mt-4 max-w-sm space-y-2 text-left text-sm">
                  {invites.map((invite) => (
                    <li key={invite.userId} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                      <span>{invite.username}</span>
                      <span className={invite.status === "accepted" ? "text-emerald-300" : invite.status === "declined" ? "text-rose-300" : "text-amber-200"}>
                        {invite.status === "accepted" ? "a accepté" : invite.status === "declined" ? "a refusé" : "invitation envoyée"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {myInvite?.status === "pending" && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button disabled={busy} onClick={() => act({ action: "join" })}>
                    Accepter (mise <Money amount={table.stake} currency={table.currency} />)
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => act({ action: "decline" })}>
                    Refuser
                  </Button>
                </div>
              )}
              {!invitedTable && mySeat == null && (
                <Button className="mt-6" disabled={busy} onClick={() => act({ action: "join" })}>
                  Rejoindre (mise <Money amount={table.stake} currency={table.currency} />)
                </Button>
              )}
              {canInviteMore && (
                <div className="mx-auto mt-6 max-w-sm text-left">
                  <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                    Joueurs disponibles · {table.currency === "lions" ? "Lions" : "Coris"}
                  </p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {roster
                      .filter((p) => !invites.some((i) => i.userId === p.id && i.status !== "declined") && !table.seats.some((s) => s.userId === p.id))
                      .filter((p) => p.username.toLowerCase().includes(guest.trim().toLowerCase()))
                      .map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => act({ action: "invite", username: p.username })}
                            className="flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-40"
                          >
                            <span>
                              {p.username}
                              {p.level === "pro" ? " · Pro" : ""}
                            </span>
                            <span className="text-xs text-amber-200">Inviter</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const username = guest.trim();
                      if (!username) return;
                      setGuest("");
                      void act({ action: "invite", username });
                    }}
                  >
                    <input
                      value={guest}
                      onChange={(e) => setGuest(e.target.value)}
                      placeholder="Filtrer ou saisir un pseudo"
                      className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-amber-300"
                    />
                    <Button type="submit" disabled={busy || !guest.trim()}>
                      Inviter
                    </Button>
                  </form>
                </div>
              )}
              {mySeat != null && (
                <Button variant="ghost" className="mt-6" disabled={busy} onClick={() => act({ action: "leave" })}>
                  {isHost && invitedTable ? "Annuler la table (mises remboursées)" : "Quitter la table (mise remboursée)"}
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
              {table.game === "run" && <RunBoard {...boardProps} state={table.state as never} />}
              {table.game === "course" && <RaceBoard {...boardProps} canPlay={courseCanPlay} state={table.state as never} />}
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
                  {table.mode === "cpu" ? `Rejouer (${table.stake} ${table.currency === "coris" ? "Coris" : "Lion(s)"})` : "Inviter pour une nouvelle partie"}
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
                const isTurn = courseState ? playing && !courseState.over && !!s && courseState.scores?.[i] == null : playing && table.currentSeat === i;
                return (
                  <li key={i} className={cx("flex items-center justify-between rounded-xl px-3 py-2 text-sm", isTurn ? "bg-amber-400/15 ring-1 ring-amber-400/50" : "bg-white/5")}>
                    <span className={cx(!s?.active && s && "line-through opacity-60")}>
                      {s ? (s.isCpu ? "🤖 " : "👤 ") + s.username : <em className="text-slate-500">Place libre</em>}
                      {s && s.seat === mySeat && <span className="ml-1 text-xs text-amber-300">(vous)</span>}
                    </span>
                    {isTurn && <span className="text-xs font-semibold text-amber-300">{courseState ? "en course" : "à jouer"}</span>}
                    {table.status === "finished" && table.winnerSeat === i && <span>🏆</span>}
                  </li>
                );
              })}
            </ul>
            {playing && (
              <p className="mt-3 text-center text-sm">
                {courseCanPlay ? (
                  <span className="font-semibold text-emerald-300">Les deux voitures courent ensemble. Le premier à la ligne gagne.</span>
                ) : myTurn ? (
                  <span className="font-semibold text-emerald-300">
                    {table.game === "ludo"
                      ? "À vous : lancez le dé, puis un seul pion."
                      : table.game === "run"
                        ? "À vous : courez le plus loin possible."
                        : "C'est à vous de jouer !"}
                  </span>
                ) : curSeat?.isCpu ? (
                  <span className="font-semibold text-amber-200">
                    {table.game === "dames"
                      ? "L'ordinateur joue un seul pion."
                      : table.game === "awale"
                        ? "L'ordinateur sème."
                        : table.game === "ludo"
                          ? "L'ordinateur joue : son dé, puis un seul pion."
                          : table.game === "run"
                            ? "L'ordinateur court."
                            : table.game === "course"
                              ? "L'ordinateur termine sa course."
                              : "L'ordinateur joue."}
                  </span>
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
