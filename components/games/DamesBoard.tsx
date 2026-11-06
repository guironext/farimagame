"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { legalMoves, type DamesState } from "@/lib/games/dames";
import { cx } from "../ui";
import type { BoardProps } from "./types";

const DamesScene = dynamic(() => import("./DamesScene").then((m) => m.DamesScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#1a120c]" />,
});

function count(board: number[], kind: number) {
  return board.reduce((n, p) => n + (p === kind ? 1 : 0), 0);
}

export function DamesBoard({ table, state, mySeat, canPlay, busy, onMove }: BoardProps<DamesState>) {
  const [sel, setSel] = useState<{ from: number; path: number[]; at: number } | null>(null);
  const flip = mySeat === 1;
  const moves = canPlay && mySeat != null ? legalMoves(state, mySeat) : [];
  const active = sel && sel.at === state.moves ? sel : null;
  const cands = active ? moves.filter((m) => m.from === active.from && active.path.every((p, i) => m.path[i] === p)) : [];
  const next = new Set(cands.map((m) => m.path[active!.path.length]).filter((x) => x !== undefined));
  const movable = new Set(moves.map((m) => m.from));
  const mustCapture = moves.length > 0 && moves[0].captures.length > 0;
  const pendingCaps = new Set(active && cands.length ? cands[0].captures.slice(0, active.path.length) : []);
  const lastSquares = new Set(state.last ? [state.last.from, ...state.last.path] : []);
  const currentPos = active ? (active.path.length ? active.path[active.path.length - 1] : active.from) : null;
  const you = mySeat === 1 ? "noirs" : "blancs";
  const turnSide = state.turn === 0 ? "blancs" : "noirs";
  const actor = table.seats[state.turn];
  const mine = canPlay;

  const display = useMemo(() => {
    const board = state.board.slice();
    if (!active) return board;
    board[active.from] = 0;
    const at = active.path.length ? active.path[active.path.length - 1] : active.from;
    board[at] = state.board[active.from];
    return board;
  }, [state.board, active]);

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

  const banner = state.over
    ? state.draw
      ? "Partie nulle"
      : "Partie terminée"
    : mine && mustCapture
      ? "Prise obligatoire. Touchez votre pièce, puis chaque saut."
      : mine && active
        ? "Touchez la case verte."
        : mine
          ? `À vous. Vous jouez les ${you}.`
          : `Tour des ${turnSide}${actor ? ` · ${actor.username}` : ""}`;

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div
        className={cx(
          "mb-2 rounded-xl border px-3 py-2 text-center text-xs font-semibold sm:text-sm",
          mine ? "border-emerald-300/40 bg-emerald-950/80 text-emerald-50" : "border-white/15 bg-slate-950/80 text-white",
        )}
      >
        {banner}
      </div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-amber-200/15 bg-[#1a120c] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)] sm:rounded-[28px]">
        <DamesScene
          display={display}
          flip={flip}
          movable={[...movable]}
          nextSquares={[...next]}
          selected={currentPos}
          pending={[...pendingCaps]}
          last={[...lastSquares]}
          busy={busy}
          onSquare={click}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400 sm:text-xs">Glissez pour tourner la table · pincez ou molette pour zoomer</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:text-sm">
        <div className={cx("rounded-xl border px-3 py-2", mySeat === 0 ? "border-amber-300/60 bg-amber-300/10" : "border-white/10")}>
          <div className="font-semibold text-stone-100">Blancs{mySeat === 0 ? " · vous" : ""}</div>
          <div className="text-slate-400">
            {count(state.board, 1)} pions · {count(state.board, 2)} dames
          </div>
        </div>
        <div className={cx("rounded-xl border px-3 py-2", mySeat === 1 ? "border-amber-300/60 bg-amber-300/10" : "border-white/10")}>
          <div className="font-semibold text-stone-100">Noirs{mySeat === 1 ? " · vous" : ""}</div>
          <div className="text-slate-400">
            {count(state.board, -1)} pions · {count(state.board, -2)} dames
          </div>
        </div>
      </div>
    </div>
  );
}
