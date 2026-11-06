"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { legalMoves, sowPath, type AwaleState } from "@/lib/games/awale";
import { cx } from "../ui";
import type { SeedFlight } from "./AwaleScene";
import type { BoardProps } from "./types";

const AwaleScene = dynamic(() => import("./AwaleScene").then((m) => m.AwaleScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#1a120c]" />,
});

function signature(s: AwaleState) {
  return `${s.moves}|${s.pits.join(",")}|${s.store.join(",")}|${s.over ? 1 : 0}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dropMs(total: number) {
  if (total > 16) return 150;
  if (total > 8) return 230;
  return 420;
}

export function AwaleBoard({ table, state, mySeat, canPlay, busy, onMove }: BoardProps<AwaleState>) {
  const mine = mySeat ?? 0;
  const other = (1 - mine) as 0 | 1;
  const names: [string, string] = [table.seats[0]?.username ?? "Joueur 1", table.seats[1]?.username ?? "Joueur 2"];
  const [view, setView] = useState(state);
  const [flight, setFlight] = useState<SeedFlight | null>(null);
  const [sowing, setSowing] = useState<0 | 1 | null>(null);
  const shownRef = useRef(state);
  const queueRef = useRef<AwaleState[]>([]);
  const running = useRef(false);
  const alive = useRef(true);
  const animating = sowing != null;
  const interactive = canPlay && !animating && !busy;
  const legal = interactive && mySeat != null ? legalMoves(state, mySeat) : [];
  const actor = table.seats[state.turn];
  const cpuTurn = !state.over && !!actor?.isCpu && !animating;
  const banner = state.over
    ? state.draw
      ? "Partie nulle"
      : "Partie terminée"
    : sowing != null
      ? `${names[sowing]} dépose les graines…`
      : interactive
        ? "À vous. Touchez un trou doré pour semer."
        : cpuTurn
          ? "L'ordinateur sème."
          : `Tour de ${actor?.username ?? names[state.turn]}`;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const latest = queueRef.current.at(-1) ?? shownRef.current;
    if (signature(state) === signature(latest)) return;
    queueRef.current.push(state);
    void run();

    async function hop(from: number, to: number, ms: number) {
      if (!alive.current) return;
      setFlight({ from, to, start: performance.now(), ms });
      await sleep(ms);
      if (alive.current) setFlight(null);
    }

    async function play(prev: AwaleState, next: AwaleState) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !next.last || next.moves !== prev.moves + 1) {
        if (alive.current) setView(next);
        return;
      }
      const seat = next.last.seat as 0 | 1;
      if (alive.current) setSowing(seat);
      const pits = prev.pits.slice();
      const store: [number, number] = [prev.store[0], prev.store[1]];
      const path = sowPath(pits, next.last.pit);
      const show = () => {
        if (!alive.current) return;
        setView((current) => ({ ...current, pits: pits.slice(), store: [store[0], store[1]] }));
      };
      pits[next.last.pit] = 0;
      show();
      await sleep(path.length ? 200 : 0);
      let at = next.last.pit;
      const step = dropMs(path.length);
      for (const dest of path) {
        if (!alive.current) return;
        await hop(at, dest, step);
        pits[dest]++;
        show();
        at = dest;
        await sleep(step > 300 ? 90 : 40);
      }
      for (const hole of next.last.captured) {
        while (alive.current && pits[hole] > 0) {
          await hop(hole, 12 + seat, 260);
          pits[hole]--;
          store[seat]++;
          show();
        }
      }
      for (let hole = 0; hole < 12 && alive.current; hole++) {
        const owner = hole < 6 ? 0 : 1;
        while (pits[hole] > (next.pits[hole] ?? 0)) {
          await hop(hole, 12 + owner, 180);
          pits[hole]--;
          store[owner]++;
          show();
        }
      }
      if (alive.current) setView(next);
    }

    async function run() {
      if (running.current) return;
      running.current = true;
      while (alive.current && queueRef.current.length) {
        const next = queueRef.current.shift()!;
        await play(shownRef.current, next);
        shownRef.current = next;
      }
      running.current = false;
      if (alive.current) {
        setSowing(null);
        setFlight(null);
      }
    }
  }, [state]);

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <div
        className={cx(
          "mb-2 rounded-xl border px-3 py-2 text-center text-xs font-semibold sm:text-sm",
          interactive
            ? "border-emerald-300/40 bg-emerald-950/80 text-emerald-50"
            : sowing != null || cpuTurn
              ? "border-amber-300/50 bg-amber-950/80 text-amber-50"
              : "border-white/15 bg-slate-950/80 text-white",
        )}
      >
        {banner}
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-amber-200/15 bg-[#1a120c] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)] sm:aspect-[16/10] sm:rounded-[28px]">
        <AwaleScene
          pits={view.pits}
          store={view.store}
          names={names}
          turn={sowing ?? state.turn}
          flip={mySeat === 1}
          movable={legal}
          lastPit={flight && flight.to < 12 ? flight.to : animating ? null : (view.last?.pit ?? null)}
          captured={animating ? [] : (view.last?.captured ?? [])}
          flight={flight}
          busy={busy || animating}
          onPit={(pit) => onMove({ pit })}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400 sm:text-xs">Glissez pour tourner la table · pincez ou molette pour zoomer</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:text-sm">
        {[mine, other].map((seat) => (
          <div
            key={seat}
            className={cx(
              "rounded-xl border px-3 py-2",
              (sowing ?? state.turn) === seat && !state.over ? "border-amber-300/60 bg-amber-300/10" : "border-white/10",
            )}
          >
            <div className="truncate font-semibold text-stone-100">
              {names[seat]}
              {seat === mySeat ? " · vous" : ""}
            </div>
            <div className="text-slate-400">{view.store[seat]} graines capturées</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500 sm:text-xs">
        Votre rangée est devant vous. Les graines se déposent une par une, de gauche à droite.
      </p>
    </div>
  );
}
