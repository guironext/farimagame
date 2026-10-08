"use client";

import { Chess, type Square } from "chess.js";
import { useMemo, useState } from "react";
import type { EchecsState } from "@/lib/games/echecs";
import { cx } from "../ui";
import type { BoardProps } from "./types";

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const FILES = "abcdefgh";

export function ChessBoard({ state, mySeat, canPlay, busy, onMove }: BoardProps<EchecsState>) {
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

  function click(sq: string) {
    if (busy || !canPlay) return;
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

  const ranks = flip ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flip ? FILES.split("").reverse() : FILES.split("");

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="relative grid grid-cols-8 overflow-hidden rounded-xl border-4 border-slate-800 shadow-2xl">
        {ranks.map((r) =>
          files.map((f) => {
            const sq = `${f}${r}`;
            const piece = chess.get(sq as Square);
            const light = (FILES.indexOf(f) + r) % 2 === 1;
            const isLast = state.last && (state.last.from === sq || state.last.to === sq);
            const kingInCheck = inCheck && piece?.type === "k" && piece.color === chess.turn();
            return (
              <div
                key={sq}
                onClick={() => click(sq)}
                className={cx(
                  "relative flex aspect-square select-none items-center justify-center",
                  light ? "bg-[#eed9b6]" : "bg-[#b58863]",
                  isLast && (light ? "bg-[#f3e27a]" : "bg-[#d0b04a]"),
                  active === sq && "bg-sky-400",
                  kingInCheck && "bg-rose-500",
                  canPlay && "cursor-pointer",
                )}
              >
                {piece && (
                  <span
                    className={cx(
                      "text-[8vw] leading-none sm:text-5xl",
                      piece.color === "w" ? "text-white [text-shadow:0_0_2px_#000,0_1px_2px_#000]" : "text-slate-900 [text-shadow:0_0_1px_#fff]",
                    )}
                  >
                    {GLYPH[piece.type]}
                    {"\uFE0E"}
                  </span>
                )}
                {targetSet.has(sq) && (
                  <span className={cx("absolute rounded-full", piece ? "inset-1 border-4 border-emerald-500/80" : "h-1/4 w-1/4 bg-emerald-600/70")} />
                )}
                {f === files[0] && <span className="absolute left-0.5 top-0 text-[9px] font-bold text-black/50">{r}</span>}
                {r === ranks[7] && <span className="absolute bottom-0 right-1 text-[9px] font-bold text-black/50">{f}</span>}
              </div>
            );
          }),
        )}
        {promo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="rounded-2xl bg-slate-900 p-4 text-center">
              <p className="mb-3 text-sm">Promotion du pion :</p>
              <div className="flex gap-2">
                {(["q", "r", "b", "n"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      onMove({ ...promo, promotion: p });
                      setPromo(null);
                    }}
                    className="h-14 w-14 rounded-xl bg-slate-700 text-4xl hover:bg-slate-600"
                  >
                    {GLYPH[p]}
                    {"\uFE0E"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>Vous jouez les {mySeat === 1 ? "noirs" : "blancs"}.</span>
        {inCheck && !state.over && <span className="font-bold text-rose-400">Échec !</span>}
      </div>
      {state.san.length > 0 && (
        <div className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-white/5 p-2 font-mono text-xs text-slate-300">
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
