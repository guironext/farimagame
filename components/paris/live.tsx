"use client";

// Composants du direct et des résultats (onglets « En direct » / « Résultats » et page match).
import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtOdds } from "@/lib/betting";
import { fmtDay, fmtTime, idParam } from "@/lib/client";
import { PERIOD_LABEL, displayScore, displayWinner, eventMinute, fmtCountdown, isGoal, matchProgress, minuteLabel, recentGoal, scorers } from "@/lib/live";
import type { BetStatus, LiveInfo, MatchEvent, MatchView } from "@/lib/types";
import { IconChevronRight } from "../icons";
import { cx } from "../ui";
import { TeamBadge } from "./shared";

const RUNNING_PERIODS = new Set(["1H", "2H", "ET", "LIVE"]);

export interface MyMatchBets {
  bets: number;
  stake: number;
  payout: number;
  status: BetStatus;
}

/** Heure courante rafraîchie périodiquement (composants rendus après chargement côté client uniquement). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// ------------------------------------------------------------------ petits éléments
export function LivePill({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_0_14px_rgba(244,63,94,0.55)]",
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-80" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      Live
    </span>
  );
}

export function LiveMinute({ live, className }: { live: LiveInfo | null; className?: string }) {
  const now = useNow(15000);
  return <span className={cx("tabular-nums", className)}>{minuteLabel(live, now)}</span>;
}

/** Barre d'avancement du match avec repère de mi-temps et buts. */
export function MatchProgressBar({ live, className }: { live: LiveInfo | null; className?: string }) {
  const now = useNow(15000);
  const { value, total } = matchProgress(live, now);
  const pct = (min: number) => `${Math.min(100, (min / total) * 100)}%`;
  return (
    <div className={className}>
      <div className="relative h-1.5 rounded-full bg-white/[0.07]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.round(value * total)} aria-label="Avancement du match">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400 transition-[width] duration-700" style={{ width: `${value * 100}%` }} />
        <span aria-hidden className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/35" style={{ left: pct(45) }} />
        {total === 120 && <span aria-hidden className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/35" style={{ left: pct(90) }} />}
        {(live?.events ?? []).filter(isGoal).map((e, i) => (
          <span
            key={i}
            aria-hidden
            title={`${eventMinute(e)} ${e.player ?? ""}`}
            className={cx("absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]", e.team === "home" ? "bg-amber-300" : "bg-sky-300")}
            style={{ left: pct(Math.min(total, e.minute + (e.extra ? 0.5 : 0))) }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium tabular-nums text-slate-500">
        <span>0&apos;</span>
        <span style={{ marginLeft: total === 120 ? "-12%" : 0 }}>MT</span>
        {total === 120 && <span>90&apos;</span>}
        <span>{total}&apos;</span>
      </div>
    </div>
  );
}

/** Buteurs (et cartons rouges) sur deux colonnes : domicile à gauche, extérieur à droite. */
export function ScorerColumns({ events, className, max = 4 }: { events: MatchEvent[]; className?: string; max?: number }) {
  const home = scorers(events, "home");
  const away = scorers(events, "away");
  if (home.length === 0 && away.length === 0) return null;
  const line = (s: { player: string; minutes: string; red?: boolean }, i: number, right: boolean) => (
    <li key={i} className={cx("flex min-w-0 items-baseline gap-1", right && "flex-row-reverse text-right")}>
      <span aria-hidden className="shrink-0 text-[10px]">{s.red ? "🟥" : "⚽"}</span>
      <span className="min-w-0 truncate">
        <span className="text-slate-300">{s.player}</span> <span className="tabular-nums text-slate-500">{s.minutes}</span>
      </span>
    </li>
  );
  return (
    <div className={cx("grid grid-cols-2 gap-3 text-[11px] leading-5", className)}>
      <ul className="min-w-0">{home.slice(0, max).map((s, i) => line(s, i, false))}</ul>
      <ul className="min-w-0">{away.slice(0, max).map((s, i) => line(s, i, true))}</ul>
    </div>
  );
}

export function MyBetBadge({ mine, className }: { mine?: MyMatchBets; className?: string }) {
  if (!mine) return null;
  const cfg = {
    won: { cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200", text: `🎉 Gagné · +${mine.payout.toLocaleString("fr-FR")} F` },
    lost: { cls: "border-rose-400/30 bg-rose-500/10 text-rose-200", text: `Perdu · ${mine.stake.toLocaleString("fr-FR")} F` },
    refunded: { cls: "border-sky-400/30 bg-sky-500/10 text-sky-200", text: `Remboursé · ${mine.payout.toLocaleString("fr-FR")} F` },
    pending: { cls: "border-amber-400/30 bg-amber-400/10 text-amber-200", text: `Mon pari · ${mine.stake.toLocaleString("fr-FR")} F` },
  }[mine.status];
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold", cfg.cls, className)}>
      🎫 {cfg.text}
      {mine.bets > 1 && <span className="font-medium opacity-70">({mine.bets})</span>}
    </span>
  );
}

function LockedOdds({ m }: { m: MatchView }) {
  const pool = m.markets.find((p) => p.market === "1N2");
  if (!pool) return null;
  return (
    <div className="flex items-center gap-1" title="Cotes au coup d'envoi (paris fermés)">
      {pool.outcomes.map((o, k) => (
        <span key={o.selection} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white/[0.03] px-1.5 py-0.5 text-[11px] tabular-nums">
          <span className="font-bold text-slate-500">{["1", "N", "2"][k]}</span>
          <span className="font-semibold text-slate-300">{fmtOdds(o.odds).replace("×", "")}</span>
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ carte « en direct »
export function LiveMatchCard({ m, mine }: { m: MatchView; mine?: MyMatchBets }) {
  const live = m.live;
  const s = displayScore(m);
  const goal = recentGoal(live);
  const href = `/paris/match/${idParam(m.id)}`;
  const scoreKey = s ? `${s.home}-${s.away}` : "none";
  return (
    <article className="surface relative overflow-hidden animate-live-glow">
      <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400" />
      <Link href={href} className="block p-3 pb-2.5 sm:p-4 sm:pb-3" aria-label={`${m.home} contre ${m.away}, en direct : détails`}>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="flex min-w-0 items-center gap-1.5 text-slate-400">
            <span className="text-sm leading-none">{m.competition.flag}</span>
            <span className="truncate">
              {m.competition.short}
              {m.round && <span className="text-slate-500"> · {m.round}</span>}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {mine && (
              <span className="hidden sm:block">
                <MyBetBadge mine={mine} />
              </span>
            )}
            <LivePill />
          </span>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <TeamBadge name={m.home} logo={m.homeLogo} size="md" />
            <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-100 sm:text-sm">{m.home}</span>
          </div>
          <div className="flex min-w-[96px] flex-col items-center">
            <div key={scoreKey} className={cx("text-[40px] font-black leading-none tracking-tight tabular-nums sm:text-5xl", goal && "animate-goal")}>
              {s ? (
                <>
                  {s.home}
                  <span className="mx-1.5 text-slate-600">:</span>
                  {s.away}
                </>
              ) : (
                <span className="text-slate-500">– : –</span>
              )}
            </div>
            <div className="mt-1.5">
              {!live || RUNNING_PERIODS.has(live.period) ? (
                <LiveMinute live={live} className="text-sm font-extrabold text-rose-300" />
              ) : (
                <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-200">{PERIOD_LABEL[live.period]}</span>
              )}
            </div>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
              {!live ? "Coup d'envoi" : RUNNING_PERIODS.has(live.period) ? PERIOD_LABEL[live.period] : ""}
              {live?.halftime && (live.period === "2H" || live.period === "ET") && <span className="normal-case tracking-normal"> · MT {live.halftime.home}-{live.halftime.away}</span>}
            </span>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <TeamBadge name={m.away} logo={m.awayLogo} size="md" />
            <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-100 sm:text-sm">{m.away}</span>
          </div>
        </div>

        {goal && (
          <div className="mt-2 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-400/40">
              ⚽ But ! <span className="font-semibold normal-case tracking-normal">{goal.player ?? (goal.team === "home" ? m.home : m.away)} {eventMinute(goal)}</span>
            </span>
          </div>
        )}

        {live && <ScorerColumns events={live.events} className="mt-2.5" max={3} />}
        <MatchProgressBar live={live} className="mt-3" />
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-line bg-white/[0.02] px-3 py-2 text-[11px] sm:px-4">
        <span className="flex min-w-0 items-center gap-1.5 text-slate-400">
          <span aria-hidden>🔒</span>
          <span className="truncate">
            Paris fermés
            {m.totalPool > 0 && (
              <>
                {" "}· Pot <strong className="font-semibold text-emerald-300">{m.totalPool.toLocaleString("fr-FR")} F</strong>
              </>
            )}
          </span>
        </span>
        <LockedOdds m={m} />
      </div>
      {mine && (
        <div className="border-t border-line px-3 py-1.5 sm:hidden">
          <MyBetBadge mine={mine} />
        </div>
      )}
    </article>
  );
}

// ------------------------------------------------------------------ état vide du direct
export function LiveEmptyState({ next, filtered, onUpcoming, onClearFilters }: { next?: MatchView; filtered: boolean; onUpcoming: () => void; onClearFilters: () => void }) {
  const now = useNow(1000);
  const ms = next ? Date.parse(next.kickoff) - now : 0;
  return (
    <div className="surface overflow-hidden text-center animate-fade-up">
      <div className="relative px-6 pb-6 pt-10">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-40 w-72 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-line-strong bg-white/[0.04] text-3xl shadow-card">📺</div>
        <p className="relative mt-4 text-lg font-bold">Aucun match en direct{filtered ? " pour ce filtre" : ""}</p>
        <p className="relative mx-auto mt-1 max-w-sm text-sm text-slate-400">
          Dès le coup d&apos;envoi, le score, la minute de jeu et les buteurs s&apos;afficheront ici, mis à jour automatiquement.
        </p>
      </div>
      {next && (
        <Link href={`/paris/match/${idParam(next.id)}`} className="block border-t border-line bg-white/[0.02] px-4 py-5 transition hover:bg-white/[0.04]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Prochain coup d&apos;envoi dans</div>
          <div className="text-gradient-brand mt-1 text-4xl font-black tabular-nums sm:text-5xl">{ms > 0 ? fmtCountdown(ms) : "Imminent"}</div>
          <div className="mx-auto mt-4 flex max-w-md items-center justify-center gap-3">
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <span className="truncate text-sm font-semibold">{next.home}</span>
              <TeamBadge name={next.home} logo={next.homeLogo} size="sm" />
            </span>
            <span className="shrink-0 rounded-lg bg-white/[0.07] px-2 py-1 text-sm font-bold tabular-nums">{fmtTime(next.kickoff)}</span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <TeamBadge name={next.away} logo={next.awayLogo} size="sm" />
              <span className="truncate text-sm font-semibold">{next.away}</span>
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {next.competition.flag} {next.competition.name} · <span className="first-letter:uppercase">{fmtDay(next.kickoff)}</span>
            {next.bettingOpen && <span className="ml-1 font-semibold text-amber-300">· Parier maintenant →</span>}
          </div>
        </Link>
      )}
      <div className="flex flex-wrap justify-center gap-2 border-t border-line px-4 py-4">
        {filtered && (
          <button type="button" onClick={onClearFilters} className="h-11 rounded-xl border border-line-strong bg-white/5 px-4 text-sm font-semibold">
            Toutes les compétitions
          </button>
        )}
        <button type="button" onClick={onUpcoming} className="bg-brand-gradient h-11 rounded-xl px-4 text-sm font-bold text-slate-950">
          Voir les matchs à venir
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ résultats
function groupBy<T>(list: T[], key: (x: T) => string): [string, T[]][] {
  const out: [string, T[]][] = [];
  for (const x of list) {
    const k = key(x);
    const last = out[out.length - 1];
    if (last && last[0] === k) last[1].push(x);
    else out.push([k, [x]]);
  }
  return out;
}

/** Résultats regroupés par jour puis par compétition (le plus récent en premier). */
export function ResultsBoard({ matches, mine }: { matches: MatchView[]; mine: Record<string, MyMatchBets> }) {
  const days = groupBy(matches, (m) => fmtDay(m.kickoff));
  return (
    <div className="space-y-6">
      {days.map(([day, list]) => {
        const byComp = new Map<string, MatchView[]>();
        for (const m of list) byComp.set(m.competitionId, [...(byComp.get(m.competitionId) ?? []), m]);
        return (
          <section key={day} className="animate-fade-up">
            <h2 className="mb-2.5 flex items-center gap-2 px-0.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
              <span className={cx("h-1.5 w-1.5 rounded-full", day === "Aujourd'hui" ? "bg-amber-400" : "bg-slate-500")} />
              <span className="first-letter:uppercase">{day}</span>
              <span className="font-medium normal-case tracking-normal text-slate-500">
                · {list.length} résultat{list.length > 1 ? "s" : ""}
              </span>
            </h2>
            <div className="grid gap-3 xl:grid-cols-2">
              {[...byComp.entries()].map(([cid, ms]) => (
                <div key={cid} className="surface overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-line bg-white/[0.03] px-3 py-2 text-xs sm:px-4">
                    <span className="text-sm leading-none">{ms[0].competition.flag}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-200">{ms[0].competition.name}</span>
                    <span className="text-slate-500">{ms[0].competition.country}</span>
                  </div>
                  <div className="divide-y divide-line">
                    {ms.map((m) => (
                      <ResultRow key={m.id} m={m} mine={mine[m.id]} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ResultTeam({ name, logo, score, win, lose, pens }: { name: string; logo?: string; score: number | null; win: boolean; lose: boolean; pens?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <TeamBadge name={name} logo={logo} size="sm" />
      <span className={cx("min-w-0 flex-1 truncate text-[15px]", win ? "font-bold text-white" : lose ? "font-medium text-slate-400" : "font-semibold text-slate-200")}>{name}</span>
      {win && <span aria-label="vainqueur" className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
      {pens != null && <span className="text-[11px] tabular-nums text-slate-500">({pens})</span>}
      <span
        className={cx(
          "w-8 shrink-0 rounded-md py-0.5 text-center text-base font-extrabold tabular-nums",
          win ? "bg-emerald-500/15 text-emerald-200" : lose ? "text-slate-400" : "text-slate-100",
        )}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

export function ResultRow({ m, mine }: { m: MatchView; mine?: MyMatchBets }) {
  const s = displayScore(m);
  const w = displayWinner(m);
  const live = m.live;
  const off = m.status === "postponed" || m.status === "cancelled";
  const pool = m.markets.find((p) => p.market === "1N2");
  const winOutcome = pool?.outcomes.find((o) => o.selection === pool.winner);
  const tag = live?.period === "AET" ? "a.p." : live?.period === "PEN" ? "t.a.b." : off ? (m.status === "postponed" ? "Rep." : "Ann.") : "Fin";
  const notes: string[] = [];
  if (live?.halftime) notes.push(`MT ${live.halftime.home}-${live.halftime.away}`);
  if (m.score && s && (m.score.home !== s.home || m.score.away !== s.away)) notes.push(`90' ${m.score.home}-${m.score.away}`);
  if (live?.penalties) notes.push(`t.a.b. ${live.penalties.home}-${live.penalties.away}`);
  return (
    <Link href={`/paris/match/${idParam(m.id)}`} className="group block px-3 py-3 transition hover:bg-white/[0.03] sm:px-4">
      <div className="flex items-center gap-3">
        <div className="flex w-10 shrink-0 flex-col items-center gap-0.5">
          <span
            className={cx(
              "rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase",
              off ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/15 text-emerald-200",
            )}
          >
            {tag}
          </span>
          <span className="text-[10px] tabular-nums text-slate-500">{fmtTime(m.kickoff)}</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <ResultTeam name={m.home} logo={m.homeLogo} score={off ? null : (s?.home ?? null)} win={w === "home"} lose={w === "away"} pens={live?.penalties?.home} />
          <ResultTeam name={m.away} logo={m.awayLogo} score={off ? null : (s?.away ?? null)} win={w === "away"} lose={w === "home"} pens={live?.penalties?.away} />
        </div>
        <IconChevronRight className="hidden h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-amber-300 sm:block" />
      </div>
      {!off && live && <ScorerColumns events={live.events} className="mt-2 pl-[3.25rem] pr-1" max={4} />}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 pl-[3.25rem] text-[11px] text-slate-500">
        {off ? (
          <span className="text-amber-200/80">{m.status === "postponed" ? "Match reporté" : "Match annulé"} · paris remboursés</span>
        ) : (
          <>
            {notes.length > 0 && <span className="tabular-nums">{notes.join(" · ")}</span>}
            {w === "draw" && <span className="rounded bg-white/10 px-1.5 py-px font-semibold text-slate-300">Match nul</span>}
            {winOutcome && (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-px font-semibold text-emerald-200">
                1N2 : {["1", "N", "2"][pool!.outcomes.indexOf(winOutcome)]} <span className="tabular-nums text-emerald-300/80">{fmtOdds(winOutcome.odds)}</span>
              </span>
            )}
          </>
        )}
        <MyBetBadge mine={mine} className="ml-auto" />
      </div>
    </Link>
  );
}

// ------------------------------------------------------------------ chronologie (page match)
const EVENT_TEXT: Record<MatchEvent["type"], string> = {
  goal: "But",
  penalty: "But sur penalty",
  "own-goal": "But contre son camp",
  "missed-penalty": "Penalty manqué",
  "red-card": "Carton rouge",
  "yellow-card": "Carton jaune",
};

function EventIcon({ e }: { e: MatchEvent }) {
  if (e.type === "red-card") return <span aria-hidden className="inline-block h-3.5 w-2.5 rounded-[2px] bg-rose-500 shadow" />;
  if (e.type === "yellow-card") return <span aria-hidden className="inline-block h-3.5 w-2.5 rounded-[2px] bg-yellow-400 shadow" />;
  if (e.type === "missed-penalty") return <span aria-hidden>❌</span>;
  return <span aria-hidden>⚽</span>;
}

/** Faits du match, chronologiques, domicile à gauche / extérieur à droite, avec le score après chaque but. */
export function EventTimeline({ m }: { m: MatchView }) {
  const live = m.live;
  if (!live) return null;
  const events = [...live.events].sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0));
  const running = { home: 0, away: 0 };
  const firstHalfOver = live.period !== "1H";
  const rows: React.ReactNode[] = [];
  let htShown = false;
  const ht = (k: string) => (
    <li key={k} className="my-1 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      <span className="h-px flex-1 bg-line" />
      Mi-temps {live.halftime ? `${live.halftime.home} - ${live.halftime.away}` : ""}
      <span className="h-px flex-1 bg-line" />
    </li>
  );
  events.forEach((e, i) => {
    if (!htShown && firstHalfOver && e.minute > 45) {
      rows.push(ht("ht"));
      htShown = true;
    }
    if (isGoal(e)) running[e.team]++;
    const score = isGoal(e) ? `${running.home} - ${running.away}` : null;
    const body = (
      <div className={cx("min-w-0", e.team === "away" && "text-left", e.team === "home" && "text-right")}>
        <div className={cx("flex items-center gap-1.5", e.team === "home" && "justify-end")}>
          {e.team === "away" && <EventIcon e={e} />}
          <span className="truncate text-sm font-semibold text-slate-100">{e.player ?? EVENT_TEXT[e.type]}</span>
          {e.team === "home" && <EventIcon e={e} />}
        </div>
        <div className="truncate text-[11px] text-slate-500">
          {e.type === "goal" ? (e.assist ? `Passe : ${e.assist}` : "But") : EVENT_TEXT[e.type]}
          {score && <span className="ml-1 font-bold tabular-nums text-amber-300">{score}</span>}
        </div>
      </div>
    );
    rows.push(
      <li key={i} className="grid grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)] items-center gap-2 py-1.5">
        <div>{e.team === "home" ? body : null}</div>
        <div className="flex justify-center">
          <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", isGoal(e) ? "bg-amber-400/15 text-amber-200" : "bg-white/[0.06] text-slate-300")}>{eventMinute(e)}</span>
        </div>
        <div>{e.team === "away" ? body : null}</div>
      </li>,
    );
  });
  if (!htShown && firstHalfOver && live.period !== "HT") rows.push(ht("ht-end"));
  if (live.period === "HT" && !htShown) rows.push(ht("ht-now"));
  const finished = m.status === "finished";
  return (
    <div className="surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Faits du match</h2>
        <span className="text-xs text-slate-500">{finished ? PERIOD_LABEL[live.period] ?? "Terminé" : "Mis à jour automatiquement"}</span>
      </div>
      <ol className="relative">
        <li className="mb-1 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <span className="h-px flex-1 bg-line" />
          Coup d&apos;envoi · {fmtTime(m.kickoff)}
          <span className="h-px flex-1 bg-line" />
        </li>
        {events.length === 0 && (
          <li className="py-4 text-center text-sm text-slate-500">{m.status === "finished" ? "Aucun but ni carton rouge." : "Aucun but ni carton rouge pour l'instant."}</li>
        )}
        {rows}
        {finished ? (
          <li className="mt-1 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
            <span className="h-px flex-1 bg-emerald-400/20" />
            Fin du match {live.goals ? `${live.goals.home} - ${live.goals.away}` : ""}
            {live.penalties ? ` (t.a.b. ${live.penalties.home}-${live.penalties.away})` : ""}
            <span className="h-px flex-1 bg-emerald-400/20" />
          </li>
        ) : (
          <li className="mt-1 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
            En cours · <LiveMinute live={live} />
          </li>
        )}
      </ol>
    </div>
  );
}
