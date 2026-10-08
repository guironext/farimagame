"use client";

import { useState } from "react";
import { legalMoves, type DamesState } from "@/lib/games/dames";
import { cx } from "../ui";
import type { BoardProps } from "./types";

export function DamesBoard({ state, mySeat, canPlay, busy, onMove }: BoardProps<DamesState>) {
  const [sel, setSel] = useState<{ from: number; path: number[]; at: number } | null>(null);
  const flip = mySeat === 1;
  const moves = canPlay && mySeat != null ? legalMoves(state, mySeat) : [];
  const active = sel && sel.at === state.moves ? sel : null;
  const cands = active ? moves.filter((m) => m.from === active.from && active.path.every((p, i) => m.path[i] === p)) : [];
  const next = new Set(cands.map((m) => m.path[active!.path.length]).filter((x) => x !== undefined));
  const movable = new Set(moves.map((m) => m.from));
  const mustCapture = moves.length > 0 && moves[0].captures.length > 0;
  const pendingCaps = new Set(
    active && cands.length ? cands[0].captures.slice(0, active.path.length) : [],
  );
  const lastSquares = new Set(state.last ? [state.last.from, ...state.last.path] : []);
  const currentPos = active ? (active.path.length ? active.path[active.path.length - 1] : active.from) : null;

  function click(sq: number) {
    if (busy) return;
    if (active && next.has(sq)) {
      const path = [...active.path, sq];
      const done = cands.find((m) => m.path.length === path.length && m.path.every((p, i) => p === path[i]));
      if (done) {
        setSel(null);
        onMove({ from: active.from, path });
      } else setSel({ ...active, path });
      return;
    }
    if (movable.has(sq)) setSel({ from: sq, path: [], at: state.moves });
    else setSel(null);
  }

  const rows = Array.from({ length: 10 }, (_, i) => (flip ? 9 - i : i));
  const cols = Array.from({ length: 10 }, (_, i) => (flip ? 9 - i : i));

  return (
    <div className="mx-auto w-full max-w-[560px]">
      {canPlay && mustCapture && (
        <p className="mb-2 text-center text-sm font-semibold text-amber-300">Prise obligatoire (maximum de pièces) !</p>
      )}
      <div className="grid grid-cols-10 overflow-hidden rounded-xl border-4 border-amber-950 shadow-2xl">
        {rows.map((r) =>
          cols.map((c) => {
            const sq = r * 10 + c;
            const dark = (r + c) % 2 === 1;
            let p = state.board[sq];
            if (active && sq === active.from) p = 0;
            if (active && sq === currentPos) p = state.board[active.from];
            const isNext = next.has(sq);
            return (
              <div
                key={sq}
                onClick={() => dark && click(sq)}
                className={cx(
                  "relative flex aspect-square items-center justify-center",
                  dark ? "bg-amber-900" : "bg-amber-100",
                  dark && lastSquares.has(sq) && "bg-amber-700",
                  (movable.has(sq) || isNext) && "cursor-pointer",
                )}
              >
                {p !== 0 && (
                  <div
                    className={cx(
                      "flex h-[78%] w-[78%] items-center justify-center rounded-full border-2 shadow-md transition",
                      p > 0 ? "border-stone-300 bg-gradient-to-br from-white to-stone-300" : "border-stone-700 bg-gradient-to-br from-stone-700 to-black",
                      movable.has(sq) && !active && "ring-2 ring-emerald-400",
                      active && sq === currentPos && "ring-4 ring-sky-400",
                      pendingCaps.has(sq) && "opacity-40",
                    )}
                  >
                    {Math.abs(p) === 2 && <span className={cx("text-sm font-black sm:text-lg", p > 0 ? "text-amber-600" : "text-amber-400")}>♛</span>}
                  </div>
                )}
                {isNext && <div className="absolute h-1/3 w-1/3 rounded-full bg-emerald-400/80 ring-2 ring-emerald-200" />}
              </div>
            );
          }),
        )}
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">
        Cliquez sur une pièce puis sur la case d&apos;arrivée (pour une rafle, cliquez chaque étape). Vous jouez les{" "}
        {mySeat === 1 ? "noirs" : "blancs"}.
      </p>
    </div>
  );
}
