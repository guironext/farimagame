"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fmtOdds } from "@/lib/betting";
import { fmtTime } from "@/lib/client";
import type { MatchView, PublicUser, Selection } from "@/lib/types";
import { IconChevronDown, IconTicket, IconTrash, IconX } from "../icons";
import { cx } from "../ui";

export interface SlipItem {
  matchId: string;
  home: string;
  away: string;
  flag: string;
  competition: string;
  kickoff: string;
  selection: Selection;
  selectionLabel: string;
}

const STORAGE_KEY = "farima:ticket";

/** Ticket de pari (une issue 1N2 par match), conservé dans le navigateur. */
export function useBetSlip() {
  const [items, setItems] = useState<SlipItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw) as SlipItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  const save = useCallback((next: SlipItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    (m: MatchView, selection: Selection, selectionLabel: string) => {
      const existing = items.find((i) => i.matchId === m.id);
      if (existing && existing.selection === selection) return save(items.filter((i) => i.matchId !== m.id));
      const item: SlipItem = {
        matchId: m.id,
        home: m.home,
        away: m.away,
        flag: m.competition.flag,
        competition: m.competition.name,
        kickoff: m.kickoff,
        selection,
        selectionLabel,
      };
      save(existing ? items.map((i) => (i.matchId === m.id ? item : i)) : [...items, item]);
    },
    [items, save],
  );

  const remove = useCallback((matchId: string) => save(items.filter((i) => i.matchId !== matchId)), [items, save]);
  const clear = useCallback(() => save([]), [save]);
  const keep = useCallback((ids: Set<string>) => save(items.filter((i) => ids.has(i.matchId))), [items, save]);

  return { items, toggle, remove, clear, keep };
}

export interface SlipLine {
  item: SlipItem;
  open: boolean;
  /** Cote estimée = cote affichée sur le bouton de l'issue. */
  odds: number | null;
  /** Gain estimé (F CFA) = mise × cote estimée. Le gain réel est fixé par le pot final (pari mutuel). */
  payout: number | null;
  /** Personne n'a encore misé sur une autre issue : sans mise adverse au coup d'envoi, la mise sera remboursée. */
  refundLikely: boolean;
}

export function computeLines(items: SlipItem[], matches: Map<string, MatchView>, stake: number, share: number, validStake: boolean): SlipLine[] {
  return items.map((item) => {
    const m = matches.get(item.matchId);
    const pool = m?.markets.find((p) => p.market === "1N2");
    const o = pool?.outcomes.find((x) => x.selection === item.selection);
    const open = !!m?.bettingOpen;
    const refundLikely = !!pool && !!o && pool.total - o.total <= 0;
    // même cote que celle affichée sur le bouton (estimation : le gain réel dépend du pot final)
    const odds = o ? o.odds : null;
    const payout = !validStake || odds == null ? null : Math.floor(stake * odds);
    return { item, open, odds, payout, refundLikely };
  });
}

interface PanelProps {
  lines: SlipLine[];
  stake: number;
  setStake: (n: number) => void;
  minStake: number;
  maxStake: number;
  me: PublicUser | null;
  busy: boolean;
  errors: Record<string, string>;
  success: string | null;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPlace: () => void;
}

/** Contenu du ticket (utilisé dans la colonne bureau et dans la feuille mobile). */
export function SlipPanel(p: PanelProps) {
  const { lines, stake, minStake, maxStake, me } = p;
  const validStake = Number.isInteger(stake) && stake >= minStake && stake <= maxStake;
  const total = validStake ? stake * lines.length : 0;
  const totalPayout = lines.reduce((a, l) => a + (l.payout ?? 0), 0);
  const closed = lines.some((l) => !l.open);
  const insufficient = !!me && total > me.fcfa;
  const chips = [minStake, 500, 1000, 2000, 5000].filter((v, i, a) => v >= minStake && v <= maxStake && a.indexOf(v) === i);

  if (lines.length === 0) {
    return (
      <div className="px-1 py-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-amber-300">
          <IconTicket className="h-7 w-7" />
        </div>
        <p className="mt-3 text-sm font-semibold">Votre ticket est vide</p>
        <p className="mt-1 text-xs text-slate-400">Touchez une cote (1, N ou 2) pour l&apos;ajouter.</p>
        {p.success && <p className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{p.success}</p>}
        {p.success && (
          <Link href="/paris/mes-paris" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-amber-300">
            Voir mes paris →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.item.matchId} className={cx("rounded-2xl border bg-white/[0.03] p-3", p.errors[l.item.matchId] ? "border-rose-500/50" : "border-line")}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] text-slate-400">
                  {l.item.flag} {l.item.competition} · {fmtTime(l.item.kickoff)}
                </div>
                <div className="truncate text-sm font-medium text-slate-200">
                  {l.item.home} – {l.item.away}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-200">1N2</span>
                  <span className="truncate text-sm font-bold text-white">{l.item.selectionLabel}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => p.onRemove(l.item.matchId)}
                aria-label="Retirer du ticket"
                className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 hover:text-white"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              {!l.open ? (
                <span className="font-semibold text-rose-300">🔒 Paris fermés – retirez ce match</span>
              ) : (
                <span className="text-slate-400">
                  Cote estimée <strong className="text-amber-300">{fmtOdds(l.odds)}</strong>
                </span>
              )}
              {l.open && l.payout != null && <span className="shrink-0 font-semibold tabular-nums text-emerald-300">~{l.payout.toLocaleString("fr-FR")} F</span>}
            </div>
            {l.open && l.refundLikely && (
              <p className="mt-1 text-[11px] text-slate-500">Aucune mise adverse pour l&apos;instant : s&apos;il n&apos;y en a toujours pas au coup d&apos;envoi, votre mise sera remboursée.</p>
            )}
            {p.errors[l.item.matchId] && <p className="mt-2 text-xs text-rose-300">{p.errors[l.item.matchId]}</p>}
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-line bg-black/20 p-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-300">
            Mise par pari
            <span className="block text-[11px] text-slate-500">
              {minStake.toLocaleString("fr-FR")} – {maxStake.toLocaleString("fr-FR")} F
            </span>
          </span>
          <span className="relative">
            <input
              type="number"
              inputMode="numeric"
              min={minStake}
              max={maxStake}
              step={50}
              value={Number.isFinite(stake) ? stake : ""}
              onChange={(e) => p.setStake(parseInt(e.target.value, 10))}
              className={cx(
                "h-11 w-32 rounded-xl border bg-slate-950/70 pl-3 pr-8 text-right text-base font-bold tabular-nums outline-none focus:ring-2",
                validStake ? "border-line-strong focus:border-amber-400 focus:ring-amber-400/30" : "border-rose-500 focus:ring-rose-500/30",
              )}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">F</span>
          </span>
        </label>
        <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto">
          {chips.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => p.setStake(v)}
              className={cx(
                "h-9 shrink-0 rounded-lg px-3 text-xs font-semibold tabular-nums transition",
                stake === v ? "bg-amber-400 text-slate-950" : "bg-white/[0.06] text-slate-300 hover:bg-white/10",
              )}
            >
              {v.toLocaleString("fr-FR")}
            </button>
          ))}
        </div>
      </div>

      <dl className="space-y-1 px-1 text-sm">
        <div className="flex justify-between text-slate-400">
          <dt>
            Total misé ({lines.length} pari{lines.length > 1 ? "s" : ""})
          </dt>
          <dd className="font-semibold tabular-nums text-white">{total.toLocaleString("fr-FR")} F</dd>
        </div>
        <div className="flex justify-between text-slate-400">
          <dt>Gain potentiel estimé*</dt>
          <dd className="text-base font-extrabold tabular-nums text-emerald-300">~{totalPayout.toLocaleString("fr-FR")} F</dd>
        </div>
        <p className="pt-0.5 text-[11px] leading-snug text-slate-500">* Estimation selon les cotes actuelles. Pari mutuel : le gain réel est fixé par le pot final au coup d&apos;envoi.</p>
        {me && (
          <div className="flex justify-between text-xs text-slate-500">
            <dt>Solde disponible</dt>
            <dd className="tabular-nums">{me.fcfa.toLocaleString("fr-FR")} F CFA</dd>
          </div>
        )}
      </dl>

      {insufficient && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          <span>Solde F CFA insuffisant.</span>
          <Link href="/portefeuille" className="inline-flex min-h-9 items-center font-bold text-amber-300">
            Recharger →
          </Link>
        </div>
      )}

      {me ? (
        <button
          type="button"
          onClick={p.onPlace}
          disabled={p.busy || !validStake || closed || insufficient}
          className="bg-brand-gradient flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-slate-950 shadow-glow transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {p.busy ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
          ) : (
            <>
              Placer {lines.length > 1 ? `les ${lines.length} paris` : "le pari"} · {total.toLocaleString("fr-FR")} F
            </>
          )}
        </button>
      ) : (
        <Link
          href="/connexion"
          className="bg-brand-gradient flex h-12 w-full items-center justify-center rounded-2xl text-[15px] font-bold text-slate-950 shadow-glow"
        >
          Se connecter pour parier
        </Link>
      )}
      <button type="button" onClick={p.onClear} className="flex min-h-11 w-full items-center justify-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-300">
        <IconTrash className="h-3.5 w-3.5" /> Vider le ticket
      </button>
    </div>
  );
}

/** Bouton flottant + feuille du bas (mobile / tablette). */
export function MobileSlip({ count, total, payout, open, setOpen, children }: { count: number; total: number; payout: number; open: boolean; setOpen: (o: boolean) => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="lg:hidden">
      {count > 0 && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bottom-above-tabbar bg-brand-gradient animate-fade-up fixed inset-x-4 z-30 mx-auto flex h-14 max-w-md items-center gap-3 rounded-2xl px-3 text-slate-950 shadow-glow"
        >
          <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-slate-950 px-2 text-sm font-extrabold text-amber-300">{count}</span>
          <span className="flex-1 text-left">
            <span className="block text-sm font-extrabold leading-tight">Mon ticket</span>
            <span className="block text-[11px] font-semibold leading-tight text-slate-900/75">
              Mise {total.toLocaleString("fr-FR")} F · Gain ~{payout.toLocaleString("fr-FR")} F
            </span>
          </span>
          <IconChevronDown className="h-5 w-5 rotate-180" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Ticket de pari">
          <button type="button" aria-label="Fermer" onClick={() => setOpen(false)} className="animate-fade-in absolute inset-0 bg-black/65 backdrop-blur-[2px]" />
          <div className="animate-sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] max-w-lg flex-col rounded-t-[1.75rem] border-t border-line-strong bg-surface shadow-2xl">
            <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-2">
              <div className="flex items-center gap-2">
                <IconTicket className="h-5 w-5 text-amber-300" />
                <h2 className="text-base font-bold">Mon ticket</h2>
                {count > 0 && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-extrabold text-slate-950">{count}</span>}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le ticket" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-white/5">
                <IconX className="h-5 w-5" />
              </button>
            </div>
            <div aria-hidden className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20" />
            <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+var(--safe-bottom))]">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
