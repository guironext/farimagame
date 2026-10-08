"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDay, fmtTime, idParam } from "@/lib/client";
import type { CompetitionView, MatchView } from "@/lib/types";
import { IconChevronRight } from "../icons";
import { OddsButton, OddsSourceTag, TeamRow } from "../paris/shared";

interface ParisData {
  matches: MatchView[];
  competitions: CompetitionView[];
  provider: { isDemo: boolean };
}

const PRIORITY = ["ucl", "can", "ci-ligue1", "cafcl", "epl", "laliga", "ligue1", "seriea", "bundesliga", "wcq-afr", "canq", "wcq-eur"];

/** Quelques matchs à venir (compétitions différentes) mis en avant sur l'accueil. */
function pickFeatured(matches: MatchView[], n: number): MatchView[] {
  const open = matches.filter((m) => m.status === "scheduled" && m.bettingOpen);
  const out: MatchView[] = [];
  const seen = new Set<string>();
  const rank = (id: string) => (PRIORITY.indexOf(id) === -1 ? 99 : PRIORITY.indexOf(id));
  // le prochain match de chaque compétition, par ordre de priorité
  const firstByComp = new Map<string, MatchView>();
  for (const m of open) if (!firstByComp.has(m.competitionId)) firstByComp.set(m.competitionId, m);
  for (const m of [...firstByComp.values()].sort((a, b) => rank(a.competitionId) - rank(b.competitionId))) {
    if (out.length >= n) break;
    out.push(m);
    seen.add(m.id);
  }
  for (const m of open) {
    if (out.length >= n) break;
    if (!seen.has(m.id)) out.push(m);
  }
  return out.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export function FeaturedMatches() {
  const [data, setData] = useState<ParisData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<ParisData>("/api/paris")
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const featured = data ? pickFeatured(data.matches, 4) : [];

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3 sm:mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">Paris sportifs · F CFA</div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Matchs à la une</h2>
        </div>
        <Link href="/paris" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-amber-300 hover:text-amber-200">
          Tous les matchs
          <IconChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="relative overflow-hidden rounded-[1.75rem] border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10 p-3 sm:p-5">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />

        {data && (
          <div className="no-scrollbar relative -mx-3 mb-3 flex gap-2 overflow-x-auto px-3 sm:-mx-5 sm:px-5">
            {data.competitions.map((c) => (
              <Link
                key={c.id}
                href="/paris"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-black/20 px-3 text-xs font-semibold text-slate-300 hover:border-line-strong hover:text-white"
              >
                <span className="text-sm">{c.flag}</span>
                {c.short}
              </Link>
            ))}
          </div>
        )}

        <div className="relative grid gap-2.5 md:grid-cols-2">
          {!data && !failed &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`surface space-y-3 p-3.5 ${i === 3 ? "hidden md:block" : ""}`} aria-hidden>
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-5 w-2/3" />
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="skeleton h-11" />
                  <div className="skeleton h-11" />
                  <div className="skeleton h-11" />
                </div>
              </div>
            ))}

          {failed && <p className="col-span-full py-6 text-center text-sm text-slate-400">Impossible de charger les matchs pour le moment.</p>}

          {data && featured.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-slate-400">Aucun match à venir pour le moment. Revenez bientôt ⚽</p>
          )}

          {featured.map((m, i) => {
            const href = `/paris/match/${idParam(m.id)}`;
            const pool = m.markets[0];
            return (
              <article key={m.id} className={`surface p-3.5 transition hover:border-line-strong ${i === 3 ? "hidden md:block" : ""}`}>
                <Link href={href} className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="text-sm">{m.competition.flag}</span>
                    <span className="truncate">{m.competition.name}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-semibold text-slate-200">
                    <span className="first-letter:uppercase">{fmtDay(m.kickoff)}</span> · {fmtTime(m.kickoff)}
                  </span>
                </Link>
                <Link href={href} className="mt-2.5 block space-y-1.5">
                  <TeamRow name={m.home} logo={m.homeLogo} />
                  <TeamRow name={m.away} logo={m.awayLogo} />
                </Link>
                {pool && (
                  <div className="mt-2.5 flex items-center justify-between px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <span>3 Way · 1 N 2</span>
                    <OddsSourceTag source={m.odds.source} books={m.odds.books} />
                  </div>
                )}
                {pool && (
                  <div className="mt-1 grid grid-cols-3 gap-1.5">
                    {pool.outcomes.map((o, k) => (
                      <OddsButton key={o.selection} label={["1", "N", "2"][k] ?? o.selection} odds={o.odds} href={`${href}?m=1N2&s=${o.selection}`} title={o.label} />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {data && (
          <p className="relative mt-3 text-center text-[11px] text-slate-500">
            {data.provider.isDemo ? "Matchs de démonstration · " : ""}Cotes estimées : pari mutuel, le gain final dépend du pot au coup d&apos;envoi.
          </p>
        )}
      </div>
    </section>
  );
}
