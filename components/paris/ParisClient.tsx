"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { selectionLabel } from "@/lib/betting";
import { api, fmtDay, fmtTime, idParam } from "@/lib/client";
import type { CompetitionGroup, CompetitionView, MatchView, PublicUser } from "@/lib/types";
import { useSession } from "../SessionProvider";
import { IconChevronRight, IconInfo } from "../icons";
import { Alert, cx } from "../ui";
import { MobileSlip, SlipPanel, computeLines, useBetSlip } from "./BetSlip";
import { LiveEmptyState, LiveMatchCard, ResultsBoard, useNow, type MyMatchBets } from "./live";
import { OddsButton, OddsSourceTag, StatusBadge, TeamRow } from "./shared";

interface ParisData {
  provider: {
    id: string;
    label: string;
    isDemo: boolean;
    lastSyncAt: string | null;
    lastError: string | null;
    odds?: { enabled: boolean };
    live?: { lastLiveAt: string | null; lastLiveError: string | null; refreshMs: number | null; quota: { used: number; limit: number; remaining: number } | null };
  };
  matches: MatchView[];
  /** Mes paris par match (connecté uniquement). */
  mine?: Record<string, MyMatchBets>;
  competitions: CompetitionView[];
  groups: { id: CompetitionGroup; label: string; emoji: string }[];
}

type View = "upcoming" | "live" | "finished";

const GROUP_SHORT: Record<CompetitionGroup, string> = {
  europe: "Europe",
  ldc: "LDC",
  afrique: "Afrique",
  eliminatoires: "Éliminatoires",
};

export function ParisClient() {
  const { me, config, setMe } = useSession();
  const [data, setData] = useState<ParisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<CompetitionGroup | "all">("all");
  const [comp, setComp] = useState<string>("all");
  const [view, setView] = useState<View>("upcoming");

  const slip = useBetSlip();
  const [stake, setStake] = useState(500);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slipErrors, setSlipErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const [loadedAt, setLoadedAt] = useState<number>(0);
  const load = useCallback(async () => {
    try {
      setData(await api<ParisData>("/api/paris"));
      setLoadedAt(Date.now());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Actualisation automatique toutes les 30 s tant que l'onglet du navigateur est visible (et dès qu'on y revient).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const compById = useMemo(() => new Map((data?.competitions ?? []).map((c) => [c.id, c])), [data]);
  const matchById = useMemo(() => new Map((data?.matches ?? []).map((m) => [m.id, m])), [data]);

  const inView = useCallback(
    (m: MatchView) =>
      view === "upcoming" ? m.status === "scheduled" : view === "live" ? m.status === "live" : m.status === "finished" || m.status === "postponed" || m.status === "cancelled",
    [view],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const list = data.matches.filter((m) => {
      const c = compById.get(m.competitionId);
      if (group !== "all" && c?.group !== group) return false;
      if (comp !== "all" && m.competitionId !== comp) return false;
      return inView(m);
    });
    return view === "finished" ? list.reverse() : list;
  }, [data, compById, group, comp, view, inView]);

  const days = useMemo(() => groupByDay(filtered), [filtered]);

  // nombre de matchs par compétition (pour la vue courante)
  const compCounts = useMemo(() => {
    const out = new Map<string, number>();
    for (const m of data?.matches ?? []) if (inView(m)) out.set(m.competitionId, (out.get(m.competitionId) ?? 0) + 1);
    return out;
  }, [data, inView]);

  const minStake = config?.BET_MIN_FCFA ?? 100;
  const maxStake = config?.BET_MAX_FCFA ?? 100000;
  const share = config?.BET_WINNERS_SHARE ?? 0.9;
  const validStake = Number.isInteger(stake) && stake >= minStake && stake <= maxStake;
  const lines = useMemo(() => computeLines(slip.items, matchById, stake, share, validStake), [slip.items, matchById, stake, share, validStake]);
  const slipTotal = validStake ? stake * lines.length : 0;
  const slipPayout = lines.reduce((a, l) => a + (l.payout ?? 0), 0);
  const selectedFor = useMemo(() => new Map(slip.items.map((i) => [i.matchId, i.selection])), [slip.items]);

  async function placeAll() {
    if (!me || !validStake || lines.length === 0) return;
    setBusy(true);
    setSuccess(null);
    const errors: Record<string, string> = {};
    let ok = 0;
    let lastUser: PublicUser | null = null;
    for (const l of lines) {
      try {
        const r = await api<{ user: PublicUser }>("/api/paris/bets", { matchId: l.item.matchId, market: "1N2", selection: l.item.selection, stake });
        lastUser = r.user;
        ok++;
      } catch (e) {
        errors[l.item.matchId] = (e as Error).message;
      }
    }
    if (lastUser) setMe(lastUser);
    setSlipErrors(errors);
    slip.keep(new Set(Object.keys(errors)));
    if (ok > 0) setSuccess(`✅ ${ok} pari${ok > 1 ? "s" : ""} enregistré${ok > 1 ? "s" : ""} (${(ok * stake).toLocaleString("fr-FR")} F CFA). Bonne chance !`);
    setBusy(false);
    await load();
  }

  if (!data) return error ? <Alert>{error}</Alert> : <ParisSkeleton />;

  const counts = {
    upcoming: data.matches.filter((m) => m.status === "scheduled").length,
    live: data.matches.filter((m) => m.status === "live").length,
  };
  const visibleComps = data.competitions.filter((c) => group === "all" || c.group === group);
  const filtersActive = group !== "all" || comp !== "all";

  const panel = (
    <SlipPanel
      lines={lines}
      stake={stake}
      setStake={setStake}
      minStake={minStake}
      maxStake={maxStake}
      me={me}
      busy={busy}
      errors={slipErrors}
      success={success}
      onRemove={(id) => {
        slip.remove(id);
        setSlipErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }}
      onClear={() => {
        slip.clear();
        setSlipErrors({});
      }}
      onPlace={placeAll}
    />
  );

  return (
    <div className={cx("space-y-4", slip.items.length > 0 && "pb-20 lg:pb-0")}>
      {/* ------------------------------------------------ en-tête */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Paris sportifs</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Pari mutuel en F CFA · <strong className="text-slate-200">{Math.round(share * 100)} %</strong> du pot aux gagnants
          </p>
        </div>
        {me ? (
          <Link
            href="/portefeuille"
            className="flex shrink-0 flex-col items-end rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 transition hover:border-emerald-400/50"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">Solde</span>
            <span className="text-sm font-extrabold tabular-nums text-emerald-200">{me.fcfa.toLocaleString("fr-FR")} F</span>
          </Link>
        ) : (
          <Link href="/connexion" className="bg-brand-gradient inline-flex h-11 shrink-0 items-center rounded-xl px-4 text-sm font-bold text-slate-950 shadow-glow-sm">
            Se connecter
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {data.provider.isDemo && (
          <details className="group flex-1 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] text-xs text-amber-100/90">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 [&::-webkit-details-marker]:hidden">
              <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-slate-950">Démo</span>
              <span className="flex-1 truncate">Matchs de démonstration (vraies équipes, scores fictifs)</span>
              <IconChevronRight className="h-4 w-4 shrink-0 transition group-open:rotate-90" />
            </summary>
            <p className="px-3 pb-3 text-amber-100/80">
              Les matchs, horaires et scores sont générés autour de la date du jour. Branchez API-Football (variable{" "}
              <code className="text-amber-200">API_FOOTBALL_KEY</code>) pour afficher les vrais matchs.
            </p>
          </details>
        )}
        <details className="group flex-1 rounded-xl border border-line bg-white/[0.03] text-xs text-slate-300">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 [&::-webkit-details-marker]:hidden">
            <IconInfo className="h-4 w-4 text-sky-300" />
            <span className="flex-1">Comment fonctionnent les cotes ?</span>
            <IconChevronRight className="h-4 w-4 shrink-0 transition group-open:rotate-90" />
          </summary>
          <div className="space-y-1.5 px-3 pb-3 text-slate-400">
            <p>
              <strong className="text-slate-200">Cote de départ</strong> : la cote des bookmakers quand elle est disponible{" "}
              <span className="text-emerald-300/90">(Cotes bookmakers)</span>, sinon une cote calculée par FarimaGame d&apos;après le niveau des équipes{" "}
              <span className="text-slate-300">(Cotes FarimaGame)</span>.
            </p>
            <p>
              <strong className="text-slate-200">Puis les mises</strong> : plus le pot grossit, plus la cote suit la répartition réelle des mises.
            </p>
            <p>
              <strong className="text-slate-200">Pari mutuel</strong> : toutes les mises d&apos;un marché forment un pot ; les gagnants se partagent {Math.round(share * 100)} % du pot
              au prorata de leur mise, la maison garde {Math.round((config?.BET_HOUSE_SHARE ?? 0.1) * 100)} %. La cote affichée est donc une estimation : votre gain final est
              fixé par le pot final au coup d&apos;envoi.
            </p>
          </div>
        </details>
      </div>

      {data.provider.lastError && <Alert>Dernière synchronisation des matchs en échec : {data.provider.lastError}</Alert>}

      {/* ------------------------------------------------ statut */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface/80 p-1 sm:w-fit sm:min-w-[420px]">
        {(
          [
            ["upcoming", "À venir", counts.upcoming],
            ["live", "En direct", counts.live],
            ["finished", "Résultats", null],
          ] as [View, string, number | null][]
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cx(
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition",
              view === id ? "bg-white text-slate-950 shadow" : "text-slate-400 hover:text-white",
            )}
          >
            {id === "live" && <span className={cx("h-1.5 w-1.5 rounded-full", n ? "animate-pulse bg-rose-500" : "bg-slate-500")} />}
            {label}
            {n != null && <span className={cx("text-xs tabular-nums", view === id ? "text-slate-500" : "text-slate-500")}>{n}</span>}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------ compétitions (collant) */}
      <div className="glass sticky top-[var(--header-h)] z-30 -mx-4 border-y border-line px-4 py-2 xl:top-16">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <Chip active={group === "all" && comp === "all"} onClick={() => (setGroup("all"), setComp("all"))}>
            <span className="text-base">🔥</span> Tout
          </Chip>
          {data.groups.map((g) => (
            <Chip key={g.id} active={group === g.id && comp === "all"} onClick={() => (setGroup(g.id), setComp("all"))}>
              <span className="text-base">{g.emoji}</span> {GROUP_SHORT[g.id] ?? g.label}
            </Chip>
          ))}
          <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-white/15" />
          {visibleComps.map((c) => (
            <Chip key={c.id} active={comp === c.id} onClick={() => setComp(comp === c.id ? "all" : c.id)} title={c.name}>
              <span className="text-base">{c.flag}</span> {c.short}
              {(compCounts.get(c.id) ?? 0) > 0 && (
                <span className={cx("rounded-full px-1.5 text-[10px] tabular-nums", comp === c.id ? "bg-slate-950/20" : "bg-white/10 text-slate-400")}>
                  {compCounts.get(c.id)}
                </span>
              )}
            </Chip>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------ liste + ticket */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {view === "live" && filtered.length > 0 && (
            <LiveStatusBar count={filtered.length} loadedAt={loadedAt} provider={data.provider} onRefresh={load} />
          )}
          {view === "live" && filtered.length === 0 && (
            <LiveEmptyState
              next={data.matches.find((m) => m.status === "scheduled" && (group === "all" || compById.get(m.competitionId)?.group === group) && (comp === "all" || m.competitionId === comp)) ?? data.matches.find((m) => m.status === "scheduled")}
              filtered={filtersActive}
              onUpcoming={() => setView("upcoming")}
              onClearFilters={() => (setGroup("all"), setComp("all"))}
            />
          )}
          {view === "live" && filtered.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {groupByCompetition(filtered, data.competitions)
                .flatMap(([, list]) => list)
                .map((m) => (
                  <LiveMatchCard key={m.id} m={m} mine={data.mine?.[m.id]} />
                ))}
            </div>
          )}
          {view === "finished" && filtered.length > 0 && <ResultsBoard matches={filtered} mine={data.mine ?? {}} />}
          {view !== "live" && days.length === 0 && (
            <div className="surface flex flex-col items-center px-6 py-14 text-center">
              <div className="text-5xl">{view === "finished" ? "🏁" : "⚽"}</div>
              <p className="mt-3 font-semibold">
                {view === "finished" ? "Aucun résultat récent" : "Aucun match à venir"}
                {filtersActive && " pour ce filtre"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {view === "finished" ? "Les scores des 3 derniers jours s'affichent ici, avec les buteurs et vos paris." : "Essayez une autre compétition."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {filtersActive && (
                  <button type="button" onClick={() => (setGroup("all"), setComp("all"))} className="h-11 rounded-xl border border-line-strong bg-white/5 px-4 text-sm font-semibold">
                    Toutes les compétitions
                  </button>
                )}
                {view !== "upcoming" && (
                  <button type="button" onClick={() => setView("upcoming")} className="bg-brand-gradient h-11 rounded-xl px-4 text-sm font-bold text-slate-950">
                    Voir les matchs à venir
                  </button>
                )}
              </div>
            </div>
          )}

          {view === "upcoming" && days.map(([day, list]) => (
            <section key={day} className="animate-fade-up">
              <h2 className="mb-2.5 flex items-center gap-2 px-0.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                <span className={cx("h-1.5 w-1.5 rounded-full", day === "Aujourd'hui" ? "bg-amber-400" : "bg-slate-500")} />
                {day}
                <span className="font-medium normal-case tracking-normal text-slate-500">
                  · {list.length} match{list.length > 1 ? "s" : ""}
                </span>
              </h2>
              <div className="space-y-2.5">
                {list.map((m) => (
                  <MatchCard
                    key={m.id}
                    m={m}
                    selected={selectedFor.get(m.id)}
                    onPick={(sel) => {
                      slip.toggle(m, sel, selectionLabel("1N2", sel, m.home, m.away));
                      setSuccess(null);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="hidden lg:block">
          <div className="surface sticky top-[calc(var(--header-h)+4.25rem)] p-4 xl:top-[8.5rem]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">🎫 Mon ticket</h2>
              {slip.items.length > 0 && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-extrabold text-slate-950">{slip.items.length}</span>}
            </div>
            {panel}
          </div>
        </aside>
      </div>

      <MobileSlip count={slip.items.length} total={slipTotal} payout={slipPayout} open={sheetOpen} setOpen={setSheetOpen}>
        {panel}
      </MobileSlip>
    </div>
  );
}

function Chip({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cx(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition active:scale-[0.97]",
        active ? "border-transparent bg-white text-slate-950 shadow" : "border-line bg-white/[0.04] text-slate-300 hover:border-line-strong hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function groupByCompetition(matches: MatchView[], comps: CompetitionView[]): [CompetitionView, MatchView[]][] {
  const order = new Map(comps.map((c, i) => [c.id, i]));
  const by = new Map<string, MatchView[]>();
  for (const m of matches) by.set(m.competitionId, [...(by.get(m.competitionId) ?? []), m]);
  return [...by.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99))
    .map(([, list]) => [list[0].competition, list]);
}

/** Bandeau du direct : nombre de matchs, fraîcheur des données, bouton d'actualisation. */
function LiveStatusBar({ count, loadedAt, provider, onRefresh }: { count: number; loadedAt: number; provider: ParisData["provider"]; onRefresh: () => void }) {
  const now = useNow(1000);
  const [spin, setSpin] = useState(false);
  const ago = loadedAt ? Math.max(0, Math.round((now - loadedAt) / 1000)) : null;
  const src = provider.live?.lastLiveAt ? Math.max(0, Math.round((now - Date.parse(provider.live.lastLiveAt)) / 60000)) : null;
  const every = provider.live?.refreshMs;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-2xl border border-rose-400/15 bg-rose-500/[0.05] px-3 py-2 text-xs">
      <span className="flex items-center gap-2 font-semibold text-rose-100">
        <span className={cx("h-2 w-2 rounded-full", count ? "animate-pulse bg-rose-500" : "bg-slate-500")} />
        {count} match{count > 1 ? "s" : ""} en direct
      </span>
      <span className="flex items-center gap-2 text-slate-400">
        <span title={provider.isDemo ? "Simulation de démonstration" : `Source : ${provider.label}`}>
          {provider.isDemo ? "Simulation démo" : "API-Football"}
          {!provider.isDemo && src != null && <> · données d&apos;il y a {src < 1 ? "moins d'1 min" : `${src} min`}</>}
          {!provider.isDemo && every != null && every > 90_000 && <> · rafraîchi toutes les ~{Math.round(every / 60000)} min</>}
        </span>
        <button
          type="button"
          onClick={async () => {
            setSpin(true);
            await onRefresh();
            setSpin(false);
          }}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white/[0.04] px-2 font-semibold text-slate-300 hover:text-white"
          aria-label="Actualiser"
        >
          <span aria-hidden className={cx("inline-block", spin && "animate-spin")}>⟳</span>
          {ago == null ? "…" : ago < 5 ? "à l'instant" : `il y a ${ago} s`}
        </button>
      </span>
    </div>
  );
}

function groupByDay(matches: MatchView[]): [string, MatchView[]][] {
  const out: [string, MatchView[]][] = [];
  for (const m of matches) {
    const d = fmtDay(m.kickoff);
    const last = out[out.length - 1];
    if (last && last[0] === d) last[1].push(m);
    else out.push([d, [m]]);
  }
  return out;
}

function MatchCard({ m, selected, onPick }: { m: MatchView; selected?: string; onPick: (sel: "1" | "N" | "2") => void }) {
  const pool = m.markets.find((p) => p.market === "1N2") ?? m.markets[0];
  const href = `/paris/match/${idParam(m.id)}`;
  const winner = pool?.winner;
  const hasScore = !!m.score;
  return (
    <article className={cx("surface p-3 transition sm:p-4", selected ? "border-amber-400/40" : "hover:border-line-strong")}>
      <Link href={href} className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex min-w-0 items-center gap-1.5 text-slate-400">
          <span className="text-sm leading-none">{m.competition.flag}</span>
          <span className="truncate">
            {m.competition.name}
            {m.round && <span className="text-slate-500"> · {m.round}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {m.totalPool > 0 && <span className="font-semibold tabular-nums text-emerald-300">Pot {m.totalPool.toLocaleString("fr-FR")} F</span>}
          {m.status === "scheduled" ? (
            <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-bold tabular-nums text-slate-100">{fmtTime(m.kickoff)}</span>
          ) : (
            <StatusBadge status={m.status} />
          )}
        </span>
      </Link>

      <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Link href={href} className="group flex min-w-0 flex-1 items-center gap-2" aria-label={`${m.home} contre ${m.away} : détails et autres marchés`}>
          <div className="min-w-0 flex-1 space-y-1.5">
            <TeamRow name={m.home} logo={m.homeLogo} score={hasScore ? m.score!.home : null} dim={hasScore && winner === "2"} />
            <TeamRow name={m.away} logo={m.awayLogo} score={hasScore ? m.score!.away : null} dim={hasScore && winner === "1"} />
          </div>
          <span className="hidden items-center gap-0.5 text-[11px] font-semibold text-slate-500 group-hover:text-amber-300 sm:flex">
            +2 marchés <IconChevronRight className="h-4 w-4" />
          </span>
        </Link>
        {pool && (
          <div className="sm:w-[264px] sm:shrink-0">
            <div className="mb-1 flex items-center justify-between gap-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>3 Way · 1 N 2</span>
              <OddsSourceTag source={m.odds.source} books={m.odds.books} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
            {pool.outcomes.map((o, k) => (
              <OddsButton
                key={o.selection}
                label={["1", "N", "2"][k] ?? o.selection}
                odds={o.odds}
                title={o.label}
                selected={selected === o.selection}
                winner={winner === o.selection}
                disabled={!m.bettingOpen}
                onClick={() => m.bettingOpen && onPick(o.selection as "1" | "N" | "2")}
              />
            ))}
          </div>
          </div>
        )}
      </div>
    </article>
  );
}

function ParisSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement des matchs">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-7 w-48" />
          <div className="skeleton h-4 w-64 max-w-[60vw]" />
        </div>
        <div className="skeleton h-11 w-24 rounded-2xl" />
      </div>
      <div className="skeleton h-10 w-full rounded-xl" />
      <div className="skeleton h-12 w-full rounded-2xl sm:w-[420px]" />
      <div className="no-scrollbar flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-11 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="skeleton h-4 w-40" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="surface space-y-3 p-3 sm:p-4">
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
    </div>
  );
}
