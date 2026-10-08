"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MARKET_BY_ID, fmtOdds } from "@/lib/betting";
import { api, fmtDate, fmtDay, fmtTime, idParam } from "@/lib/client";
import type { BetView, MarketId, MatchView, PublicUser, Selection } from "@/lib/types";
import { useSession } from "../SessionProvider";
import { Alert, Button, ButtonLink, Card, Money, Spinner, cx, inputClass } from "../ui";
import { PERIOD_LABEL, displayScore, displayWinner, recentGoal } from "@/lib/live";
import { EventTimeline, LiveMinute, LivePill, MatchProgressBar, ScorerColumns } from "./live";
import { DemoBanner, OddsSourceTag, OutcomeButton, Scoreline, StatusBadge, TeamBadge } from "./shared";
import { BetStatusBadge } from "./MyBetsClient";

interface MatchData {
  match: MatchView;
  myBets: BetView[];
  provider: { isDemo: boolean };
}

export function MatchClient({ id }: { id: string }) {
  const { me, config, setMe } = useSession();
  const [data, setData] = useState<MatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<{ market: MarketId; selection: Selection } | null>(null);
  const [stake, setStake] = useState<number>(500);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<MatchData>(`/api/paris/match/${idParam(id)}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get("m") as MarketId | null;
    const s = q.get("s") as Selection | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (m && s && MARKET_BY_ID[m]?.outcomes.some((o) => o.selection === s)) setPick({ market: m, selection: s });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return error ? <Alert>{error}</Alert> : <Spinner label="Chargement du match…" />;
  const { match: m, myBets } = data;
  const minStake = config?.BET_MIN_FCFA ?? 100;
  const maxStake = config?.BET_MAX_FCFA ?? 100000;
  const share = config?.BET_WINNERS_SHARE ?? 0.9;

  const pool = pick ? m.markets.find((x) => x.market === pick.market) : undefined;
  const outcome = pool?.outcomes.find((o) => o.selection === pick?.selection);
  const validStake = Number.isInteger(stake) && stake >= minStake && stake <= maxStake;
  const noOpponent = !!pool && !!outcome && pool.total - outcome.total <= 0;
  const oddsWithMe = outcome ? outcome.odds : null; // même cote que celle affichée (estimation)
  const estPayout = validStake && oddsWithMe != null ? Math.floor(stake * oddsWithMe) : null;
  const isLive = m.status === "live";
  const finished = m.status === "finished";
  const shown = displayScore(m);
  const w = displayWinner(m);
  const goal = recentGoal(m.live);
  const live = m.live;

  async function placeBet() {
    if (!pick) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ user: PublicUser; match: MatchView }>("/api/paris/bets", { matchId: m.id, market: pick.market, selection: pick.selection, stake });
      setMe(r.user);
      setMsg({ kind: "success", text: `Pari enregistré : ${stake.toLocaleString("fr-FR")} F CFA sur « ${outcome?.label} ». Bonne chance !` });
      setPick(null);
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/paris" className="text-slate-400 hover:text-white">← Tous les matchs</Link>
        {me && <Link href="/paris/mes-paris" className="text-slate-400 hover:text-white">🎫 Mes paris</Link>}
      </div>

      {data.provider.isDemo && m.source !== "api-football" && <DemoBanner>Match de démonstration : équipes réelles, rencontre et score fictifs.</DemoBanner>}

      <div className={cx("surface relative overflow-hidden", isLive && "animate-live-glow")}>
        {isLive && <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400" />}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-sm sm:px-5">
          <span className="min-w-0 truncate font-semibold">
            {m.competition.flag} {m.competition.name} {m.round && <span className="font-normal text-slate-400">· {m.round}</span>}
          </span>
          <span className="shrink-0">{isLive ? <LivePill /> : <StatusBadge status={m.status} />}</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 pb-6 pt-7 sm:gap-3 sm:px-10 sm:py-8">
          <div className="flex min-w-0 flex-col items-center gap-2.5 text-center sm:gap-3">
            <TeamBadge name={m.home} logo={m.homeLogo} size="lg" />
            <span className={cx("line-clamp-2 text-[15px] font-bold leading-tight sm:text-xl", w === "away" && "text-slate-400")}>{m.home}</span>
            <span className="text-xs text-slate-500">{w === "home" ? "🏆 Vainqueur" : "Domicile"}</span>
          </div>
          <div className="flex min-w-[104px] flex-col items-center gap-2">
            {(isLive || finished) && shown ? (
              <div key={`${shown.home}-${shown.away}`} className={cx("text-5xl font-black leading-none tracking-tight tabular-nums sm:text-6xl", goal && "animate-goal")}>
                {shown.home}
                <span className="mx-2 text-slate-600">:</span>
                {shown.away}
              </div>
            ) : (
              <Scoreline match={m} big />
            )}
            {isLive ? (
              <>
                <LiveMinute live={live} className="text-lg font-extrabold text-rose-300" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{live ? PERIOD_LABEL[live.period] : "Coup d'envoi donné"}</span>
              </>
            ) : finished ? (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
                {live?.period === "AET" ? "Après prolongation" : live?.period === "PEN" ? "Aux tirs au but" : "Score final"}
              </span>
            ) : (
              <>
                <span className="text-xs text-slate-400 first-letter:uppercase">{fmtDay(m.kickoff)}</span>
                <span className="rounded-lg bg-white/5 px-2 py-0.5 text-sm font-semibold tabular-nums">{fmtTime(m.kickoff)}</span>
              </>
            )}
            {live?.halftime && (isLive || finished) && live.period !== "HT" && (
              <span className="text-[11px] tabular-nums text-slate-500">Mi-temps {live.halftime.home} - {live.halftime.away}</span>
            )}
            {live?.penalties && <span className="text-[11px] font-semibold tabular-nums text-amber-200">t.a.b. {live.penalties.home} - {live.penalties.away}</span>}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2.5 text-center sm:gap-3">
            <TeamBadge name={m.away} logo={m.awayLogo} size="lg" />
            <span className={cx("line-clamp-2 text-[15px] font-bold leading-tight sm:text-xl", w === "home" && "text-slate-400")}>{m.away}</span>
            <span className="text-xs text-slate-500">{w === "away" ? "🏆 Vainqueur" : "Extérieur"}</span>
          </div>
        </div>
        {goal && isLive && (
          <div className="-mt-3 mb-4 flex justify-center px-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-400/40">
              ⚽ But ! <span className="font-semibold normal-case tracking-normal">{goal.player ?? (goal.team === "home" ? m.home : m.away)}</span>
            </span>
          </div>
        )}
        {(isLive || finished) && live && (
          <div className="space-y-3 px-4 pb-5 sm:px-10">
            <ScorerColumns events={live.events} max={8} className="text-xs" />
            {isLive && <MatchProgressBar live={live} />}
          </div>
        )}
        {finished && m.score && shown && (m.score.home !== shown.home || m.score.away !== shown.away) && (
          <p className="border-t border-white/10 px-5 py-2 text-center text-[11px] text-slate-400">
            Score à 90 min : <strong className="tabular-nums text-slate-200">{m.score.home} - {m.score.away}</strong> · les paris sont réglés sur ce score (hors prolongation et tirs au but).
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 border-t border-white/10 px-5 py-3 text-xs text-slate-400">
          <span>Pot total : <strong className="text-emerald-300">{m.totalPool.toLocaleString("fr-FR")} F CFA</strong></span>
          {m.venue && <span>📍 {m.venue}</span>}
          <span>{m.bettingOpen ? "🟢 Paris ouverts jusqu'au coup d'envoi" : m.settled ? "✅ Paris réglés" : "🔒 Paris fermés"}</span>
        </div>
      </div>

      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {(isLive || finished) && live && <EventTimeline m={m} />}
          {m.markets.map((p) => {
            const def = MARKET_BY_ID[p.market];
            return (
              <Card key={p.market}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{def.label}</h2>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    <OddsSourceTag source={m.odds.source} books={m.odds.books} />
                    Pot : {p.total.toLocaleString("fr-FR")} F
                  </span>
                </div>
                <div className="flex gap-2">
                  {p.outcomes.map((o, k) => (
                    <OutcomeButton
                      key={o.selection}
                      outcome={o}
                      short={p.market === "1N2" ? (k === 1 ? "Nul" : o.label) : def.outcomes[k].label}
                      selected={pick?.market === p.market && pick.selection === o.selection}
                      winner={p.winner === o.selection}
                      disabled={!m.bettingOpen}
                      onClick={() => m.bettingOpen && setPick({ market: p.market, selection: o.selection })}
                    />
                  ))}
                </div>
                {p.market === "BTTS" && m.odds.source === "bookmakers" && (
                  <p className="mt-2 text-[11px] text-slate-500">Cote déduite des cotes bookmakers 1 N 2 et +/- 2,5 buts (modèle FarimaGame).</p>
                )}
                {p.total > 0 && (
                  <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/5">
                    {p.outcomes.map((o, k) => (
                      <div key={o.selection} style={{ width: `${(o.total / p.total) * 100}%` }} className={["bg-amber-400", "bg-slate-400", "bg-sky-400"][k]} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          <Card className="text-sm text-slate-400">
            <h3 className="mb-2 font-semibold text-slate-200">Comment fonctionne le pari mutuel ?</h3>
            <ul className="space-y-1">
              <li>• Toutes les mises d&apos;un marché (ex. 1 N 2) vont dans un même pot.</li>
              <li>• Au coup de sifflet final, la maison garde {Math.round((1 - share) * 100)} % et les gagnants se partagent {Math.round(share * 100)} % du pot, au prorata de leur mise.</li>
              <li>
                • La cote de départ vient des bookmakers quand elle est disponible (« Cotes bookmakers »), sinon elle est calculée par FarimaGame d&apos;après le niveau des
                équipes (« Cotes FarimaGame »). Plus le pot grossit, plus la cote suit les mises réelles
                {m.markets[0] ? ` (poids actuel du pot : ${Math.round(m.markets[0].blendWeight * 100)} %)` : ""}.
              </li>
              <li>• La cote affichée est donc une estimation : votre gain final est fixé par le pot final au coup d&apos;envoi.</li>
              <li>• Match reporté ou annulé, personne sur l&apos;issue gagnante, ou tout le monde sur la même issue : remboursement intégral.</li>
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-amber-400/20 lg:sticky lg:top-20">
            <h2 className="mb-3 font-semibold">🎫 Ticket de pari</h2>
            {!m.bettingOpen ? (
              <p className="text-sm text-slate-400">Les paris sont fermés pour ce match.</p>
            ) : !pick || !outcome ? (
              <p className="text-sm text-slate-400">Choisissez une issue pour remplir votre ticket.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-xs text-slate-400">{MARKET_BY_ID[pick.market].label}</div>
                  <div className="font-semibold text-amber-200">{outcome.label}</div>
                  <div className="text-xs text-slate-400">
                    {m.home} - {m.away}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Mise (F CFA)</span>
                  <input
                    type="number"
                    min={minStake}
                    max={maxStake}
                    step={50}
                    value={Number.isFinite(stake) ? stake : ""}
                    onChange={(e) => setStake(parseInt(e.target.value, 10))}
                    className={inputClass}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {[minStake, 500, 1000, 2000, 5000].filter((v, i, a) => v >= minStake && v <= maxStake && a.indexOf(v) === i).map((v) => (
                    <button key={v} onClick={() => setStake(v)} className={cx("rounded-lg px-3 py-1 text-xs", stake === v ? "bg-amber-400 text-slate-950" : "bg-white/5 hover:bg-white/10")}>
                      {v.toLocaleString("fr-FR")}
                    </button>
                  ))}
                </div>
                <div className="space-y-1 rounded-xl border border-white/10 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Cote estimée</span><span className="font-semibold text-amber-300">{fmtOdds(oddsWithMe)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Gain estimé</span><span className="font-semibold text-emerald-300">{estPayout != null ? `~${estPayout.toLocaleString("fr-FR")} F CFA` : "—"}</span></div>
                  <p className="pt-1 text-[11px] text-slate-500">
                    Estimation = mise × cote affichée. Pari mutuel : le gain réel est fixé par le pot final au coup d&apos;envoi.
                    {noOpponent && " Aucune mise adverse pour l'instant : s'il n'y en a toujours pas au coup d'envoi, votre mise sera remboursée."}
                  </p>
                </div>
                {!validStake && <p className="text-xs text-rose-300">Mise entre {minStake.toLocaleString("fr-FR")} et {maxStake.toLocaleString("fr-FR")} F CFA (nombre entier).</p>}
                {me ? (
                  <>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Votre solde</span>
                      <Money amount={me.fcfa} currency="fcfa" className="text-emerald-300" />
                    </div>
                    {validStake && me.fcfa < stake ? (
                      <ButtonLink href="/portefeuille" className="w-full">Solde insuffisant : recharger</ButtonLink>
                    ) : (
                      <Button className="w-full py-3" disabled={busy || !validStake} onClick={placeBet}>
                        {busy ? "Validation…" : `Parier ${Number.isFinite(stake) ? stake.toLocaleString("fr-FR") : 0} F CFA`}
                      </Button>
                    )}
                  </>
                ) : (
                  <ButtonLink href="/connexion" className="w-full">Se connecter pour parier</ButtonLink>
                )}
              </div>
            )}
          </Card>

          {myBets.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold">Mes paris sur ce match</h2>
              <div className="divide-y divide-white/5 text-sm">
                {myBets.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{b.selectionLabel}</div>
                      <div className="text-xs text-slate-500">{MARKET_BY_ID[b.market].short} · {fmtDate(b.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="tabular-nums">{b.stake.toLocaleString("fr-FR")} F</div>
                      <BetStatusBadge bet={b} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
