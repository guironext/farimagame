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
  const [lists, setLists] = useState<{ open: TableView[]; mine: TableView[]; invites: TableView[] } | null>(null);
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
    api<{ players: { id: string; username: string; level: string }[] }>(`/api/joueurs?currency=${tableCurrency}`)
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
  const stake = cur === "coris" ? config.STAKE_CORIS : config.PRO_STAKE_LIONS;
  const players = modePlayers(effectiveMode);
  const inviteCount = effectiveMode === "cpu" ? 0 : players - 1;
  const pot = stake * players;
  const prize = pot * config.WINNER_SHARE;
  const balance = cur === "coris" ? me.coris : me.lions;
  const invitations = lists?.invites ?? [];
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
        invites: picked.map((p) => p.username),
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

  return (
    <div className="space-y-8">
      <PageTitle title="Salon de jeu" subtitle="Choisissez un jeu, un mode et lancez une partie." />

      {!isPro && <SalonProCta />}

      {invitations.length > 0 && (
        <Card className="border-emerald-400/30">
          <h2 className="mb-3 font-semibold">Invitations reçues</h2>
          <div className="space-y-3">
            {invitations.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-3">
                <div className="text-sm">
                  <div className="font-semibold">
                    {GAMES[t.game].emoji} {GAMES[t.game].name} · {modeLabel(t.mode)}
                  </div>
                  <div className="text-slate-400">
                    {t.seats[0]?.username} vous invite · mise <Money amount={t.stake} currency={t.currency} /> · le vainqueur remporte 80 %
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button disabled={busy || (t.currency === "lions" && !isPro)} onClick={() => answer(t.id, "join")}>
                    Accepter
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => answer(t.id, "decline")}>
                    Refuser
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {active.length > 0 && (
        <Card className="border-amber-400/30">
          <h2 className="mb-3 font-semibold">Vos parties en cours</h2>
          <div className="flex flex-wrap gap-2">
            {active.map((t) => (
              <Link key={t.id} href={`/jeu/${t.id}`} className="rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                {GAMES[t.game].emoji} {GAMES[t.game].short} · {modeLabel(t.mode)} ·{" "}
                <span className={t.status === "playing" ? "text-emerald-300" : "text-amber-300"}>
                  {t.status === "playing" ? (t.currentSeat === t.mySeat ? "à vous de jouer" : "en cours") : `en attente ${t.seats.length}/${t.maxPlayers}`}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">1. Le jeu</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {GAME_LIST.map((g) => (
            <button
              key={g.id}
              onClick={() => setGame(g.id)}
              className={cx(
                "rounded-2xl border p-4 text-left transition",
                game === g.id ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[0.03] hover:border-white/25",
              )}
            >
              <div className={`mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${g.color} text-2xl`}>{g.emoji}</div>
              <div className="font-bold">{g.name}</div>
              <div className="text-xs text-slate-400">{g.modes.length === 4 ? "Ordinateur, 2, 3 ou 4 joueurs" : "Ordinateur ou 2 joueurs"}</div>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">2. Le mode</h2>
          <div className="grid grid-cols-2 gap-2">
            {meta.modes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cx(
                  "rounded-xl border px-3 py-3 text-sm font-semibold transition",
                  effectiveMode === m ? "border-amber-400 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[0.03] hover:border-white/25",
                )}
              >
                {m === "cpu" ? "🤖 " : "👥 "}
                {modeLabel(m)}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">3. La monnaie</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCurrency("coris")}
              className={cx("rounded-xl border px-3 py-3 text-sm font-semibold", cur === "coris" ? "border-amber-400 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[0.03]")}
            >
              🐚 Coris (normal)
            </button>
            <button
              onClick={() => isPro && setCurrency("lions")}
              disabled={!isPro}
              title={isPro ? "" : "Réservé aux joueurs Pro"}
              className={cx(
                "rounded-xl border px-3 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                cur === "lions" ? "border-fuchsia-400 bg-fuchsia-400/10 text-fuchsia-200" : "border-white/10 bg-white/[0.03]",
              )}
            >
              🦁 Lions (Pro)
            </button>
          </div>
          {!isPro && (
            <p className="mt-2 text-xs text-slate-500">
              Les parties en Lions sont réservées aux joueurs Pro. <Link href="/pro" className="text-fuchsia-300">Passer Pro →</Link>
            </p>
          )}
        </section>
      </div>

      {inviteCount > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            4. Inviter {inviteCount} joueur{inviteCount > 1 ? "s" : ""}
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

      <Card className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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
        <Button onClick={create} disabled={busy || balance < stake || picked.length !== inviteCount} className="w-full px-6 py-3 sm:w-auto">
          {effectiveMode === "cpu" ? "Jouer contre l'ordinateur" : "Envoyer les invitations"}
        </Button>
      </Card>
      {balance < stake && <Alert kind="info">Solde insuffisant pour cette mise.</Alert>}
      {error && <Alert>{error}</Alert>}

      <section>
        <h2 className="mb-3 text-lg font-bold">Tables ouvertes</h2>
        {!lists ? (
          <Spinner />
        ) : lists.open.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune table en attente pour le moment. Créez-en une !</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lists.open.map((t) => {
              const locked = t.currency === "lions" && !isPro;
              return (
                <Card key={t.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {GAMES[t.game].emoji} {GAMES[t.game].name}
                    </span>
                    <span className="text-xs text-slate-400">{modeLabel(t.mode)}</span>
                  </div>
                  <div className="text-sm text-slate-300">
                    {t.seats.map((s) => s.username).join(", ")} · {t.seats.length}/{t.maxPlayers}
                  </div>
                  <div className="flex items-center justify-between">
                    <Money amount={t.stake} currency={t.currency} />
                    <Button variant={t.currency === "lions" ? "pro" : "primary"} disabled={busy || locked} onClick={() => join(t.id)}>
                      {locked ? "Pro uniquement" : "Rejoindre"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/** Bandeau du salon : passage gratuit au niveau Pro, puis jeu en Lions. */
export function SalonProCta() {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-fuchsia-400/35 bg-gradient-to-br from-violet-600/30 via-fuchsia-600/15 to-amber-500/10 p-5 shadow-xl shadow-fuchsia-950/20 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-fuchsia-400/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 left-6 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-200">Niveau Pro</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Jouez en Lions</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-300">
            Passez Pro gratuitement, convertissez vos Coris et misez en Lions. Le vainqueur empoche toujours 80&nbsp;%.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-200">
            <li className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Gratuit</li>
            <li className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Parties en Lions</li>
            <li className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Les Coris restent ouverts</li>
          </ul>
        </div>
        <ButtonLink href="/pro" variant="pro" className="h-12 w-full shrink-0 rounded-2xl px-6 text-[15px] shadow-lg shadow-fuchsia-900/40 sm:w-auto sm:min-w-44">
          Passer Pro
        </ButtonLink>
      </div>
    </section>
  );
}
