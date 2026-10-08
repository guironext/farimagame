"use client";

import Link from "next/link";
import { STATUS_LABEL, fmtOdds } from "@/lib/betting";
import type { MatchStatus, MatchView, OddsSource, OutcomePool } from "@/lib/types";
import { cx } from "../ui";

const PALETTE = [
  "from-rose-500 to-red-700",
  "from-sky-500 to-blue-700",
  "from-emerald-500 to-green-700",
  "from-amber-400 to-orange-600",
  "from-violet-500 to-purple-700",
  "from-cyan-400 to-teal-600",
  "from-fuchsia-500 to-pink-700",
  "from-lime-400 to-green-600",
  "from-indigo-500 to-blue-800",
  "from-yellow-300 to-amber-600",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w));
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[1][0] + (words[2]?.[0] ?? "")).toUpperCase();
}

export function TeamBadge({ name, logo, size = "md" }: { name: string; logo?: string; size?: "sm" | "md" | "lg" }) {
  const dim = { sm: "h-7 w-7 text-[9px]", md: "h-9 w-9 text-[10px]", lg: "h-16 w-16 text-base" }[size];
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" className={cx(dim, "shrink-0 rounded-full bg-white/90 object-contain p-0.5")} />
    );
  }
  return (
    <span
      aria-hidden
      className={cx(dim, "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-extrabold text-white shadow-md ring-1 ring-white/20", PALETTE[hash(name) % PALETTE.length])}
    >
      {initials(name)}
    </span>
  );
}

export function StatusBadge({ status }: { status: MatchStatus }) {
  const s = {
    scheduled: "bg-white/10 text-slate-300",
    live: "bg-rose-500/20 text-rose-200",
    finished: "bg-emerald-500/15 text-emerald-200",
    postponed: "bg-amber-500/20 text-amber-200",
    cancelled: "bg-slate-500/20 text-slate-300",
  }[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", s)}>
      {status === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function DemoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
      <span className="mt-0.5 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-slate-950">Démo</span>
      <div>{children}</div>
    </div>
  );
}

/** Petite étiquette discrète indiquant l'origine des cotes de référence. */
export function OddsSourceTag({ source, books, className }: { source: OddsSource | "modele"; books?: number; className?: string }) {
  const bk = source === "bookmakers";
  return (
    <span
      title={
        bk
          ? `Cote de référence : médiane de ${books ?? "plusieurs"} bookmaker(s) (The Odds API), ajustée à la marge FarimaGame, puis mélangée aux mises du pot.`
          : "Cote de référence calculée par FarimaGame d'après le niveau des équipes, puis mélangée aux mises du pot."
      }
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold normal-case tracking-normal",
        bk ? "bg-emerald-500/10 text-emerald-300/90" : "bg-white/[0.06] text-slate-400",
        className,
      )}
    >
      <span aria-hidden className={cx("h-1 w-1 rounded-full", bk ? "bg-emerald-400" : "bg-slate-400")} />
      {bk ? "Cotes bookmakers" : "Cotes FarimaGame"}
    </span>
  );
}

/** Bouton d'issue (1 / N / 2…) avec cote estimée et montant du pot. */
export function OutcomeButton({
  outcome,
  short,
  selected,
  winner,
  disabled,
  onClick,
  compact,
}: {
  outcome: OutcomePool;
  short: string;
  selected?: boolean;
  winner?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border px-2 transition",
        compact ? "py-1.5" : "py-3",
        winner
          ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
          : selected
            ? "border-amber-400 bg-amber-400/20 text-amber-100 shadow-lg shadow-amber-500/10"
            : "border-white/10 bg-slate-900/60 text-slate-200 hover:border-white/25 hover:bg-white/5",
        disabled && !winner && !selected && "cursor-default opacity-60 hover:border-white/10 hover:bg-slate-900/60",
      )}
    >
      <span className={cx("font-bold", compact ? "text-xs" : "text-sm")}>{short}</span>
      <span className={cx("tabular-nums text-amber-300", compact ? "text-[11px]" : "text-sm font-semibold")}>{fmtOdds(outcome.odds)}</span>
      {!compact && <span className="mt-0.5 text-[11px] tabular-nums text-slate-400">{outcome.total.toLocaleString("fr-FR")} F · {outcome.bets} pari(s)</span>}
    </button>
  );
}

export function Scoreline({ match, big }: { match: Pick<MatchView, "score" | "status" | "kickoff">; big?: boolean }) {
  if (match.score) {
    return (
      <span className={cx("font-extrabold tabular-nums", big ? "text-4xl" : "text-lg")}>
        {match.score.home} <span className="text-slate-500">-</span> {match.score.away}
      </span>
    );
  }
  return <span className={cx("font-bold text-slate-500", big ? "text-3xl" : "text-sm")}>vs</span>;
}

/** Bouton de cote compact (listes de matchs) : « 1  ×1,85 ». Rendu en lien si `href` est fourni. */
export function OddsButton({
  label,
  odds,
  selected,
  winner,
  disabled,
  onClick,
  href,
  title,
}: {
  label: string;
  odds: number | null;
  selected?: boolean;
  winner?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  title?: string;
}) {
  const cls = cx(
    "group/odds flex h-11 min-w-0 items-center justify-between gap-1 rounded-xl border px-2.5 text-sm transition active:scale-[0.97] sm:px-3",
    winner
      ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
      : selected
        ? "bg-brand-gradient border-transparent text-slate-950 shadow-glow-sm"
        : "border-line bg-surface-2/80 text-slate-200 hover:border-amber-400/50 hover:bg-surface-3",
    disabled && !winner && !selected && "pointer-events-none opacity-50",
  );
  const inner = (
    <>
      <span className={cx("text-xs font-bold", selected ? "text-slate-900/70" : "text-slate-400")}>{label}</span>
      <span className={cx("font-bold tabular-nums", selected ? "text-slate-950" : winner ? "text-emerald-200" : odds == null ? "text-slate-500" : "text-amber-300")}>
        {odds == null ? "—" : fmtOdds(odds).replace("×", "")}
      </span>
    </>
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={cls} title={title}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} className={cls} title={title}>
      {inner}
    </button>
  );
}

/** Ligne d'équipe : écusson (ou initiales) + nom + score éventuel. */
export function TeamRow({ name, logo, score, dim }: { name: string; logo?: string; score?: number | null; dim?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <TeamBadge name={name} logo={logo} size="sm" />
      <span className={cx("min-w-0 flex-1 truncate text-[15px] font-semibold", dim ? "text-slate-400" : "text-slate-100")}>{name}</span>
      {score != null && <span className="w-6 text-right text-base font-extrabold tabular-nums">{score}</span>}
    </div>
  );
}
