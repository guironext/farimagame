"use client";

import { legalMoves, type AwaleState } from "@/lib/games/awale";
import { cx } from "../ui";
import type { BoardProps } from "./types";

function Seeds({ n }: { n: number }) {
  const shown = Math.min(n, 15);
  return (
    <div className="flex max-w-[64px] flex-wrap items-center justify-center gap-[3px]">
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-100 to-amber-700 shadow sm:h-3 sm:w-3" />
      ))}
    </div>
  );
}

export function AwaleBoard({ table, state, mySeat, canPlay, busy, onMove }: BoardProps<AwaleState>) {
  const bottom = mySeat ?? 0;
  const top = 1 - bottom;
  const legal = canPlay && mySeat != null ? legalMoves(state, mySeat) : [];
  const bottomPits = Array.from({ length: 6 }, (_, i) => bottom * 6 + i);
  const topPits = Array.from({ length: 6 }, (_, i) => top * 6 + 5 - i);
  const last = state.last;

  const renderPit = (i: number) => {
    const playable = legal.includes(i) && !busy;
    const isLast = last?.pit === i;
    const captured = last?.captured.includes(i);
    return (
      <button
        key={i}
        disabled={!playable}
        onClick={() => onMove({ pit: i })}
        className={cx(
          "relative flex aspect-square w-full flex-col items-center justify-center rounded-full border-2 bg-gradient-to-b from-amber-950 to-amber-900 shadow-inner shadow-black/60 transition",
          playable ? "cursor-pointer border-amber-300 hover:scale-105 hover:border-amber-200" : "border-amber-950",
          isLast && "ring-2 ring-sky-400",
          captured && "ring-2 ring-rose-500",
        )}
        aria-label={`Trou ${(i % 6) + 1} : ${state.pits[i]} graines`}
      >
        <Seeds n={state.pits[i]} />
        <span className="absolute -bottom-1 right-0 rounded-full bg-black/70 px-1.5 text-[11px] font-bold text-amber-200 sm:text-xs">
          {state.pits[i]}
        </span>
      </button>
    );
  };

  const renderStore = (seat: number) => (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-gradient-to-b from-amber-950 to-amber-900 px-2 py-3 shadow-inner shadow-black/60 sm:px-3">
      <span className="max-w-[70px] truncate text-[10px] text-amber-300/80 sm:text-xs">{table.seats[seat]?.username}</span>
      <span className="text-2xl font-black text-amber-200 sm:text-3xl">{state.store[seat]}</span>
      <span className="text-[10px] text-amber-300/60">graines</span>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="grid grid-cols-[auto_1fr_auto] items-stretch gap-2 rounded-[2rem] border-4 border-amber-950 bg-gradient-to-br from-amber-700 to-amber-800 p-2 shadow-2xl sm:gap-3 sm:p-4">
        {renderStore(top)}
        <div className="grid grid-rows-2 gap-2 sm:gap-3">
          <div className="grid grid-cols-6 gap-1.5 sm:gap-3">{topPits.map((i) => renderPit(i))}</div>
          <div className="grid grid-cols-6 gap-1.5 sm:gap-3">{bottomPits.map((i) => renderPit(i))}</div>
        </div>
        {renderStore(bottom)}
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">
        Semis dans le sens inverse des aiguilles d&apos;une montre (votre rangée de gauche à droite). Capture par 2 ou 3 graines chez l&apos;adversaire.
      </p>
    </div>
  );
}
