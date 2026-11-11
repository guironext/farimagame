"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, fmtAmount } from "@/lib/client";
import { GAMES, GAME_LIST, modeLabel, modePlayers } from "@/lib/games/meta";
import type { Currency, GameId, Mode, TableView } from "@/lib/types";
import { useSession } from "./SessionProvider";
import { Alert, Button, ButtonLink, Card, Money, PageTitle, Spinner, cx, useRequireAuth } from "./ui";

export function LobbyClient() {
  const { me, loading, config } = useRequireAuth();
  const { refresh } = useSession();
  const router = useRouter();
  const [game, setGame] = useState<GameId>("awale");
  const [mode, setMode] = useState<Mode>("cpu");
  const [currency, setCurrency] = useState<Currency>("coris");
  const [lists, setLists] = useState<{ open: TableView[]; mine: TableView[]; invites: TableView[]; defis?: TableView[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<{ id: string; username: string }[]>([]);
  const [query, setQuery] = useState("");
  const [roster, setRoster] = useState<{ id: string; username: string; level: string }[]>([]);

  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("jeu") as GameId | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (g && GAMES[g]) setGame(g);
  }, []);

  useEffect(() => {
    if (loading || !me) return;
    document.getElementById(`salon-jeu-${game}`)?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [game, loading, me]);

  const load = useCallback(async () => {
    try {
      setLists(await api("/api/tables"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [me, load]);

  useEffect(() => {
    const allowed = GAMES[game].modes.includes(mode) ? mode : "cpu";
    const need = allowed === "cpu" ? 0 : modePlayers(allowed) - 1;
    setPicked((prev) => (prev.length > need ? prev.slice(0, need) : prev));
  }, [game, mode]);

  useEffect(() => {
    if (!me) return;
    const allowed = GAMES[game].modes.includes(mode) ? mode : "cpu";
    if (allowed === "cpu") return;
    const tableCurrency = me.level === "pro" && currency === "lions" ? "lions" : "coris";
    let cancel = false;
    api<{ players: { id: string; username: string; level: string }[] }>(`/api/joueurs?currency=${tableCurrency}&game=${game}`)
      .then((r) => {
        if (!cancel) setRoster(r.players);
      })
      .catch(() => {
        if (!cancel) setRoster([]);
      });
    return () => {
      cancel = true;
    };
  }, [me, game, mode, currency]);

  if (loading || !me || !config) return <Spinner />;

  const meta = GAMES[game];
  const effectiveMode = meta.modes.includes(mode) ? mode : "cpu";
  const isPro = me.level === "pro";
  const cur: Currency = isPro ? currency : "coris";
  const stake = cur === "coris" ? meta.stakeCoris : config.PRO_STAKE_LIONS;
  const players = modePlayers(effectiveMode);
  const inviteCount = effectiveMode === "cpu" ? 0 : players - 1;
  const pot = stake * players;
  const prize = pot * config.WINNER_SHARE;
  const balance = cur === "coris" ? me.coris : me.lions;
  const invitations = (lists?.invites ?? []).filter((t) =>
    t.invites.some((i) => i.userId === me.id && i.status === "pending"),
  );
  const defis = isPro ? (lists?.defis ?? []) : [];
  const launchingDefi = cur === "lions" && effectiveMode !== "cpu";
  const shown = roster.filter((p) => p.username.toLowerCase().includes(query.trim().toLowerCase()));

  function pickPlayer(player: { id: string; username: string }) {
    setPicked((prev) => (prev.some((p) => p.id === player.id) || prev.length >= inviteCount ? prev : [...prev, player]));
    setQuery("");
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>("/api/tables", {
        game,
        mode: effectiveMode,
        currency: cur,
        invites: launchingDefi ? [] : picked.map((p) => p.username),
      });
      await refresh();
      router.push(`/jeu/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function answer(id: string, action: "join" | "decline") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tables/${id}`, { action });
      await refresh();
      if (action === "join") router.push(`/jeu/${id}`);
      else await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function join(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tables/${id}`, { action: "join" });
      await refresh();
      router.push(`/jeu/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      load();
    }
  }

  const active = lists?.mine.filter((t) => t.status === "playing" || t.status === "waiting") ?? [];
  const canLaunch = !busy && balance >= stake && (launchingDefi || picked.length === inviteCount);
  const launchLabel = effectiveMode === "cpu" ? "Jouer" : launchingDefi ? "Lancer un défi" : "Inviter";

  return (
    <div className="space-y-5 pb-[calc(var(--tabbar-h)+var(--safe-bottom)+6.75rem)] xl:space-y-8 xl:pb-0">
      <SalonHeading />

      {active.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200">Parties en cours</h2>
          <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {active.map((t) => (
              <Link
                key={t.id}
                href={`/jeu/${t.id}`}
                className="flex min-h-14 w-[78%] shrink-0 snap-start items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2.5 sm:w-auto"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${GAMES[t.game].color} text-xl`}>
                  {GAMES[t.game].emoji}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{GAMES[t.game].name}</span>
                  <span className={cx("block text-xs", t.status === "playing" ? "text-emerald-300" : "text-amber-200")}>
                    {t.status === "playing" ? (t.currentSeat === t.mySeat ? "À vous de jouer" : "En cours") : `En attente ${t.seats.length}/${t.maxPlayers}`}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <InvitesAndChallenges
        invitations={invitations}
        defis={defis}
        meId={me.id}
        busy={busy}
        isPro={isPro}
        onAnswer={answer}
        onJoin={join}
      />

      <SalonGamePicker game={game} onPick={setGame} />

      <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-3 sm:p-4">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mode</h2>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {meta.modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cx(
                "min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition",
                effectiveMode === m ? "border-amber-300 bg-amber-400/15 text-amber-100" : "border-white/10 bg-black/20 text-slate-300",
              )}
            >
              {m === "cpu" ? "Ordinateur" : `${m} joueurs`}
            </button>
          ))}
        </div>
        <h2 className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Monnaie</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCurrency("coris")}
            className={cx("min-h-12 rounded-xl border px-3 text-sm font-semibold", cur === "coris" ? "border-amber-300 bg-amber-400/15 text-amber-100" : "border-white/10 bg-black/20")}
          >
            🐚 Coris
          </button>
          <button
            type="button"
            onClick={() => isPro && setCurrency("lions")}
            disabled={!isPro}
            className={cx(
              "min-h-12 rounded-xl border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45",
              cur === "lions" ? "border-fuchsia-300 bg-fuchsia-400/15 text-fuchsia-100" : "border-white/10 bg-black/20",
            )}
          >
            🦁 Lions
          </button>
        </div>
        {!isPro && (
          <p className="mt-2 text-xs text-slate-500">
            Les Lions sont réservés aux joueurs Pro. <Link href="/passer-pro" className="font-semibold text-fuchsia-300">Passez Pro</Link>
          </p>
        )}
      </section>

      {launchingDefi && (
        <Card className="border-fuchsia-400/30">
          <h2 className="font-semibold">Défi Pro</h2>
          <p className="mt-1 text-sm text-slate-300">
            Ce défi en Lions sera visible par tous les joueurs Pro. Ils peuvent rejoindre une place libre, et le vainqueur empoche 80&nbsp;%.
          </p>
        </Card>
      )}

      {inviteCount > 0 && !launchingDefi && (
        <section>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Inviter {inviteCount} joueur{inviteCount > 1 ? "s" : ""}
          </h2>
          <Card>
            <p className="mb-3 text-sm text-slate-300">
              La partie commence seulement quand {inviteCount === 1 ? "ce joueur accepte" : "ces joueurs acceptent"}. Le plateau apparaît alors, et le vainqueur remporte 80 % du pot.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {picked.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-full border border-amber-300/50 bg-amber-300/10 px-3 py-1 text-sm"
                  onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
                >
                  {p.username} ×
                </button>
              ))}
            </div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
              Joueurs disponibles · {cur === "lions" ? "Lions, joueurs Pro" : "Coris"}
            </p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer la liste"
              className="mb-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-amber-300"
            />
            {shown.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun joueur libre pour cette partie. Ils doivent avoir le solde de la mise et ne pas être déjà à une table.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {shown.map((p) => {
                  const selected = picked.some((x) => x.id === p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={!selected && picked.length >= inviteCount}
                        onClick={() => (selected ? setPicked((prev) => prev.filter((x) => x.id !== p.id)) : pickPlayer(p))}
                        className={cx(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm disabled:opacity-40",
                          selected ? "bg-amber-300/15 text-amber-100" : "bg-white/5 hover:bg-white/10",
                        )}
                      >
                        <span>
                          {p.username}
                          {p.level === "pro" ? " · Pro" : ""}
                        </span>
                        <span className="text-xs">{selected ? "choisi" : "inviter"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      )}

      <Card className="hidden items-center justify-between gap-4 xl:flex">
        <div className="space-y-1 text-sm">
          <div>
            Mise : <Money amount={stake} currency={cur} /> · Pot ({players} mises{effectiveMode === "cpu" ? ", l'ordinateur mise aussi" : ""}) :{" "}
            <Money amount={pot} currency={cur} />
          </div>
          <div className="text-emerald-300">
            Gain si vous gagnez : <Money amount={prize} currency={cur} /> (80 %)
          </div>
          <div className="text-xs text-slate-500">
            Votre solde : {fmtAmount(balance)} {cur === "coris" ? "Coris" : "Lions"}
          </div>
        </div>
        <Button onClick={create} disabled={!canLaunch} className="px-6 py-3">
          {effectiveMode === "cpu" ? "Jouer contre l'ordinateur" : launchingDefi ? "Lancer un défi" : "Envoyer les invitations"}
        </Button>
      </Card>
      {balance < stake && <Alert kind="info">Solde insuffisant pour cette mise.</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="bottom-above-tabbar fixed inset-x-0 z-30 px-3 xl:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-white/10 bg-[#07111f]/95 p-2.5 shadow-2xl shadow-black/50 backdrop-blur">
          <div className="min-w-0 flex-1 pl-1">
            <p className="truncate text-sm font-bold">{meta.name}</p>
            <p className="truncate text-xs text-slate-400">
              <Money amount={stake} currency={cur} /> · gain <Money amount={prize} currency={cur} className="text-emerald-300" />
            </p>
          </div>
          <Button onClick={create} disabled={!canLaunch} className="h-11 shrink-0 rounded-xl px-4">
            {launchLabel}
          </Button>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Tables ouvertes</h2>
        {!lists ? (
          <Spinner />
        ) : lists.open.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune table en attente pour le moment. Créez-en une !</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lists.open.map((t) => {
              const locked = t.currency === "lions" && !isPro;
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${GAMES[t.game].color} text-xl`}>
                    {GAMES[t.game].emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{GAMES[t.game].name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {modeLabel(t.mode)} · {t.seats.length}/{t.maxPlayers} · <Money amount={t.stake} currency={t.currency} />
                    </p>
                  </div>
                  <Button variant={t.currency === "lions" ? "pro" : "primary"} disabled={busy || locked} onClick={() => join(t.id)} className="h-10 shrink-0 px-3">
                    {locked ? "Pro" : "Rejoindre"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function SalonGamePicker({ game, onPick }: { game: GameId; onPick: (id: GameId) => void }) {
  const meta = GAMES[game];
  return (
    <section aria-labelledby="salon-le-jeu">
      <h2 id="salon-le-jeu" className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
        Le jeu
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {GAME_LIST.map((g) => {
          const selected = game === g.id;
          return (
            <button
              key={g.id}
              id={`salon-jeu-${g.id}`}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(g.id)}
              className={cx(
                "relative overflow-hidden rounded-[1.35rem] text-left outline-none transition duration-200",
                "focus-visible:ring-2 focus-visible:ring-white",
                selected ? "z-[1] ring-2 ring-amber-200 shadow-glow-sm" : "ring-1 ring-white/10 active:scale-[0.98]",
              )}
            >
              <span className={`relative flex h-[8.75rem] flex-col justify-between overflow-hidden bg-gradient-to-br p-3.5 sm:h-[9.5rem] ${g.color}`}>
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(255,255,255,0.42),transparent_40%),radial-gradient(circle_at_100%_120%,rgba(0,0,0,0.4),transparent_48%)]" />
                <span aria-hidden className="pointer-events-none absolute -right-5 -top-6 h-20 w-20 rounded-full border-[10px] border-white/15" />
                <span aria-hidden className={cx("pointer-events-none absolute inset-0 bg-[#050b1a]/20 transition duration-200", selected && "bg-transparent")} />
                <span className="relative flex items-start justify-between gap-2">
                  <span className="text-[2.05rem] leading-none drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)] sm:text-4xl">{g.emoji}</span>
                  <span
                    aria-hidden
                    className={cx(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-black",
                      selected ? "bg-white text-slate-950" : "border border-white/50 bg-black/25 text-transparent",
                    )}
                  >
                    ✓
                  </span>
                </span>
                <span className="relative">
                  <span className="block text-[15px] font-black leading-tight tracking-tight text-white sm:text-base">{g.name}</span>
                  <span className="mt-1.5 inline-flex rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white/95 backdrop-blur-sm">
                    {g.stakeCoris} Coris
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl ${meta.color}`}>{meta.emoji}</span>
        <p className="min-w-0 pt-0.5 text-sm leading-relaxed text-slate-300">
          <span className="font-bold text-white">{meta.name}. </span>
          {meta.description}
        </p>
      </div>
    </section>
  );
}

function hostName(t: TableView) {
  return t.seats.find((s) => s.userId === t.createdBy)?.username ?? t.seats[0]?.username ?? "Un joueur";
}

/** Invitations privées du joueur connecté, et défis Pro visibles par tous les joueurs Pro. */
export function InvitesAndChallenges({
  invitations,
  defis,
  meId,
  busy,
  isPro,
  onAnswer,
  onJoin,
}: {
  invitations: TableView[];
  defis: TableView[];
  meId: string;
  busy: boolean;
  isPro: boolean;
  onAnswer: (id: string, action: "join" | "decline") => void;
  onJoin: (id: string) => void;
}) {
  const total = invitations.length + defis.length;
  if (total === 0) return null;
  return (
    <section aria-labelledby="invitations-defis" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-200">Pour vous</p>
          <h2 id="invitations-defis" className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
            Invitations et Défis
          </h2>
        </div>
        {total > 0 && (
          <span className="rounded-full bg-fuchsia-400/15 px-2.5 py-1 text-xs font-bold text-fuchsia-100">{total}</span>
        )}
      </div>

      <Card className="border-emerald-400/25">
        <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-200">Invitations</h3>
        {invitations.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Aucune invitation ne vous est adressée.</p>
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {invitations.map((t) => (
              <li key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${GAMES[t.game].color} text-2xl`}>
                    {GAMES[t.game].emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {GAMES[t.game].name} · {modeLabel(t.mode)}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-300">
                      <strong className="text-white">{hostName(t)}</strong> vous invite · mise <Money amount={t.stake} currency={t.currency} />
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">Le vainqueur empoche 80&nbsp;%.</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button disabled={busy || (t.currency === "lions" && !isPro)} onClick={() => onAnswer(t.id, "join")}>
                    Accepter
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => onAnswer(t.id, "decline")}>
                    Refuser
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isPro && (
        <Card className="border-fuchsia-400/30">
          <h3 className="text-sm font-bold uppercase tracking-wide text-fuchsia-200">Défis Pro</h3>
          <p className="mt-1 text-xs text-slate-400">Visibles par tous les joueurs Pro.</p>
          {defis.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Aucun défi en Lions pour le moment.</p>
          ) : (
            <ul className="mt-3 grid gap-3 lg:grid-cols-2">
              {defis.map((t) => {
                const mine = t.createdBy === meId || t.mySeat != null;
                return (
                  <li key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-start gap-3">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${GAMES[t.game].color} text-2xl`}>
                        {GAMES[t.game].emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {GAMES[t.game].name} · {modeLabel(t.mode)}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-300">
                          <strong className="text-white">{hostName(t)}</strong>
                          {mine ? " · votre défi" : " lance un défi"} · mise <Money amount={t.stake} currency={t.currency} />
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {t.seats.length}/{t.maxPlayers} joueurs · le vainqueur empoche 80&nbsp;%.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      {mine ? (
                        <ButtonLink href={`/jeu/${t.id}`} variant="pro" className="w-full">
                          Ouvrir
                        </ButtonLink>
                      ) : (
                        <Button variant="pro" className="w-full" disabled={busy} onClick={() => onJoin(t.id)}>
                          Rejoindre
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </section>
  );
}

export function SalonHeading() {
  return (
    <div className="flex items-start justify-between gap-3">
      <PageTitle className="mb-0 min-w-0 flex-1" title="Salon de jeu" subtitle="Choisissez un jeu et lancez la partie." />
      <ButtonLink href="/passer-pro" variant="pro" className="h-10 shrink-0 rounded-xl px-3.5 py-0 text-sm shadow-lg shadow-fuchsia-900/30">
        Passez Pro
      </ButtonLink>
    </div>
  );
}

/** Bandeau du salon : passage gratuit au niveau Pro, puis jeu en Lions. */
export function SalonProCta() {
  return (
    <Link
      href="/passer-pro"
      className="flex items-center justify-between gap-3 rounded-2xl border border-fuchsia-400/30 bg-gradient-to-r from-violet-600/25 to-fuchsia-600/10 px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold">Jouez en Lions</span>
        <span className="block text-xs text-slate-400">Passez Pro gratuitement · le vainqueur empoche 80 %</span>
      </span>
      <span className="shrink-0 text-sm font-bold text-fuchsia-200">Pro →</span>
    </Link>
  );
}
