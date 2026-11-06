"use client";

import { Chess, type Square } from "chess.js";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { EchecsState } from "@/lib/games/echecs";
import { cx } from "../ui";
import type { BoardProps } from "./types";

const ChessScene = dynamic(() => import("./ChessScene").then((m) => m.ChessScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#1a120c]" />,
});

const GLYPH: Record<string, string> = { q: "♛", r: "♜", b: "♝", n: "♞" };
const PROMO = [
  ["q", "Dame"],
  ["r", "Tour"],
  ["b", "Fou"],
  ["n", "Cavalier"],
] as const;

export function ChessBoard({ table, state, mySeat, canPlay, busy, onMove }: BoardProps<EchecsState>) {
  const chess = useMemo(() => new Chess(state.fen), [state.fen]);
  const [sel, setSel] = useState<{ sq: string; fen: string } | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const flip = mySeat === 1;
  const active = sel && sel.fen === state.fen ? sel.sq : null;
  const targets = useMemo(
    () => (active && canPlay ? chess.moves({ square: active as Square, verbose: true }) : []),
    [active, canPlay, chess],
  );
  const targetSet = new Set<string>(targets.map((m) => m.to));
  const myColor = mySeat === 1 ? "b" : "w";
  const inCheck = chess.inCheck();
  const turnName = chess.turn() === "w" ? "blancs" : "noirs";
  const you = mySeat === 1 ? "noirs" : "blancs";
  const turnSeat = chess.turn() === "w" ? 0 : 1;
  const actor = table.seats[turnSeat];
  const pieces = useMemo(() => {
    const list: { sq: string; kind: string }[] = [];
    for (const row of chess.board()) {
      for (const sq of row) {
        if (sq) list.push({ sq: sq.square, kind: `${sq.color}${sq.type.toUpperCase()}` });
      }
    }
    return list;
  }, [chess]);
  const movable = useMemo(() => {
    if (!canPlay) return [];
    return [...new Set(chess.moves({ verbose: true }).map((m) => m.from))];
  }, [canPlay, chess]);
  let check: string | null = null;
  if (inCheck) {
    for (const piece of pieces) {
      if (piece.kind === `${chess.turn()}K`) check = piece.sq;
    }
  }

  function click(sq: string) {
    if (busy || !canPlay || promo) return;
    if (active && targetSet.has(sq)) {
      const m = targets.find((t) => t.to === sq)!;
      setSel(null);
      if (m.promotion) setPromo({ from: active, to: sq });
      else onMove({ from: active, to: sq });
      return;
    }
    const piece = chess.get(sq as Square);
    if (piece && piece.color === myColor) setSel({ sq, fen: state.fen });
    else setSel(null);
  }

  const banner = state.over
    ? state.draw
      ? `Partie nulle${state.reason ? ` · ${state.reason}` : ""}`
      : "Partie terminée"
    : canPlay
      ? inCheck
        ? `Échec. À vous, les ${you}.`
        : `À vous. Vous jouez les ${you}.`
      : inCheck
        ? `Échec. Tour des ${turnName}${actor ? ` · ${actor.username}` : ""}.`
        : `Tour des ${turnName}${actor ? ` · ${actor.username}` : ""}.`;

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div
        className={cx(
          "mb-2 rounded-xl border px-3 py-2 text-center text-xs font-semibold sm:text-sm",
          canPlay ? "border-emerald-300/40 bg-emerald-950/80 text-emerald-50" : "border-white/15 bg-slate-950/80 text-white",
          inCheck && !state.over && "border-rose-400/50 bg-rose-950/80 text-rose-50",
        )}
      >
        {banner}
      </div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-amber-200/15 bg-[#1a120c] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)] sm:rounded-[28px]">
        <ChessScene
          pieces={pieces}
          flip={flip}
          selected={active}
          targets={[...targetSet]}
          movable={movable}
          last={state.last ? [state.last.from, state.last.to] : []}
          check={check}
          busy={busy}
          onSquare={click}
        />
        {promo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-center">
              <p className="mb-3 text-sm font-semibold">Promotion du pion</p>
              <div className="grid grid-cols-4 gap-2">
                {PROMO.map(([piece, name]) => (
                  <button
                    key={piece}
                    type="button"
                    onClick={() => {
                      onMove({ ...promo, promotion: piece });
                      setPromo(null);
                    }}
                    className="rounded-xl bg-white/10 px-1 py-2 hover:bg-white/20"
                  >
                    <span className="block text-3xl leading-none">{GLYPH[piece]}</span>
                    <span className="mt-1 block text-[10px] text-slate-300">{name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400 sm:text-xs">Glissez pour tourner la table · pincez ou molette pour zoomer</p>
      {state.san.length > 0 && (
        <div className="mt-3 max-h-24 overflow-y-auto rounded-xl bg-white/5 p-2 font-mono text-xs text-slate-300">
          {state.san.map((m, i) => (
            <span key={i} className="mr-2">
              {i % 2 === 0 && <span className="text-slate-500">{i / 2 + 1}. </span>}
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
