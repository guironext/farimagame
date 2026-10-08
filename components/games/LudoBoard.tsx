"use client";

import { COLOR_START, HOME, LUDO_COLORS, SAFE_GLOBALS, movableTokens, type LudoState } from "@/lib/games/ludo";
import { Button, cx } from "../ui";
import type { BoardProps } from "./types";

type RC = [number, number];

// Parcours de 52 cases (index global), départ du rouge en (6,1), sens horaire.
const TRACK: RC[] = (() => {
  const t: RC[] = [];
  for (let c = 1; c <= 5; c++) t.push([6, c]);
  for (let r = 5; r >= 0; r--) t.push([r, 6]);
  t.push([0, 7]);
  for (let r = 0; r <= 5; r++) t.push([r, 8]);
  for (let c = 9; c <= 14; c++) t.push([6, c]);
  t.push([7, 14]);
  for (let c = 14; c >= 9; c--) t.push([8, c]);
  for (let r = 9; r <= 14; r++) t.push([r, 8]);
  t.push([14, 7]);
  for (let r = 14; r >= 9; r--) t.push([r, 6]);
  for (let c = 5; c >= 0; c--) t.push([8, c]);
  t.push([7, 0]);
  t.push([6, 0]);
  return t;
})();

const HOME_COL: RC[][] = [
  [1, 2, 3, 4, 5].map((c) => [7, c] as RC),
  [1, 2, 3, 4, 5].map((r) => [r, 7] as RC),
  [13, 12, 11, 10, 9].map((c) => [7, c] as RC),
  [13, 12, 11, 10, 9].map((r) => [r, 7] as RC),
];
const FINISH: RC[] = [
  [7, 6],
  [6, 7],
  [7, 8],
  [8, 7],
];
const BASE_ORIGIN: RC[] = [
  [0, 0],
  [0, 9],
  [9, 9],
  [9, 0],
];
const BASE_SPOTS: RC[] = [
  [1, 1],
  [1, 4],
  [4, 1],
  [4, 4],
];

const BG = ["bg-red-500", "bg-green-500", "bg-yellow-400", "bg-blue-500"];
const BG_SOFT = ["bg-red-500/80", "bg-green-500/80", "bg-yellow-400/80", "bg-blue-500/80"];
const TOKEN = [
  "from-red-400 to-red-700 border-red-200",
  "from-green-400 to-green-700 border-green-200",
  "from-yellow-200 to-yellow-500 border-yellow-50",
  "from-blue-400 to-blue-700 border-blue-200",
];

function posToRC(color: number, pos: number, token: number): RC {
  if (pos === -1) {
    const o = BASE_ORIGIN[color];
    const s = BASE_SPOTS[token];
    return [o[0] + s[0], o[1] + s[1]];
  }
  if (pos === HOME) return FINISH[color];
  if (pos > 50) return HOME_COL[color][pos - 51];
  return TRACK[(COLOR_START[color] + pos) % 52];
}

const DICE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function LudoBoard({ table, state, mySeat, canPlay, busy, onMove }: BoardProps<LudoState>) {
  const myMovable = canPlay && mySeat != null && state.phase === "move" && state.dice ? movableTokens(state, mySeat, state.dice) : [];
  const cellBg = new Map<string, string>();
  TRACK.forEach(([r, c]) => cellBg.set(`${r},${c}`, "bg-white"));
  COLOR_START.forEach((g, color) => cellBg.set(TRACK[g].join(","), BG_SOFT[color]));
  HOME_COL.forEach((cells, color) => cells.forEach(([r, c]) => cellBg.set(`${r},${c}`, BG_SOFT[color])));
  const safe = new Set(SAFE_GLOBALS.map((g) => TRACK[g].join(",")));

  // regroupement des pions par case
  const groups = new Map<string, { seat: number; color: number; token: number; rc: RC }[]>();
  state.tokens.forEach((toks, seat) => {
    if (!state.active[seat] && !state.over) return;
    toks.forEach((pos, token) => {
      const color = state.colors[seat];
      const rc = posToRC(color, pos, token);
      const k = rc.join(",");
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push({ seat, color, token, rc });
    });
  });

  const turnColor = state.colors[state.turn];

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="relative grid aspect-square grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))] overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-200 shadow-2xl">
        {/* bases */}
        {BASE_ORIGIN.map(([r, c], color) => (
          <div key={`b${color}`} className={cx("p-[8%]", BG[color])} style={{ gridRow: `${r + 1} / span 6`, gridColumn: `${c + 1} / span 6` }}>
            <div className="h-full w-full rounded-lg bg-white/90" />
          </div>
        ))}
        {/* centre */}
        <div
          className="bg-[conic-gradient(from_45deg,#22c55e_0_25%,#facc15_0_50%,#3b82f6_0_75%,#ef4444_0_100%)]"
          style={{ gridRow: "7 / span 3", gridColumn: "7 / span 3" }}
        />
        {/* cases */}
        {[...cellBg.entries()].map(([k, bg]) => {
          const [r, c] = k.split(",").map(Number);
          return (
            <div key={k} className={cx("flex items-center justify-center border-[0.5px] border-slate-400/60 text-[10px] text-slate-500", bg)} style={{ gridRow: r + 1, gridColumn: c + 1 }}>
              {safe.has(k) && "★"}
            </div>
          );
        })}
        {/* pions */}
        {[...groups.entries()].map(([k, list]) => {
          const [r, c] = list[0].rc;
          return (
            <div key={`t${k}`} className="z-10 flex flex-wrap items-center justify-center gap-[1px] p-[1px]" style={{ gridRow: r + 1, gridColumn: c + 1 }}>
              {list.map((t) => {
                const clickable = t.seat === mySeat && myMovable.includes(t.token) && !busy;
                const size = list.length > 2 ? "h-[45%] w-[45%]" : list.length === 2 ? "h-[48%] w-[48%]" : "h-[80%] w-[80%]";
                return (
                  <button
                    key={`${t.seat}-${t.token}`}
                    disabled={!clickable}
                    onClick={() => onMove({ type: "move", token: t.token })}
                    className={cx(
                      "rounded-full border-2 bg-gradient-to-br shadow-md shadow-black/40",
                      TOKEN[t.color],
                      size,
                      clickable && "animate-pulse cursor-pointer ring-2 ring-black ring-offset-1",
                    )}
                    aria-label={`Pion ${LUDO_COLORS[t.color]} ${t.token + 1}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cx("h-4 w-4 rounded-full", BG[turnColor])} />
          <span className="text-sm text-slate-300">
            Tour de <strong className="text-white">{table.seats[state.turn]?.username}</strong> ({LUDO_COLORS[turnColor]})
          </span>
        </div>
        <div className="flex items-center gap-3">
          {state.lastRoll && (
            <span key={`${state.moves}-${state.lastRoll.value}-${table.version}`} className="animate-roll text-5xl leading-none text-white" title={`Dernier lancer : ${state.lastRoll.value}`}>
              {DICE[state.lastRoll.value]}
            </span>
          )}
          {canPlay && state.phase === "roll" && (
            <Button onClick={() => onMove({ type: "roll" })} disabled={busy}>
              🎲 Lancer le dé
            </Button>
          )}
          {canPlay && state.phase === "move" && <span className="text-sm font-semibold text-amber-300">Choisissez un pion à avancer de {state.dice}</span>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {table.seats.map((s) => {
          const color = state.colors[s.seat];
          const home = state.tokens[s.seat]?.filter((p) => p === HOME).length ?? 0;
          return (
            <span key={s.seat} className={cx("inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1", !s.active && "line-through opacity-50")}>
              <span className={cx("h-2.5 w-2.5 rounded-full", BG[color])} />
              {s.username} · {home}/4 à la maison
            </span>
          );
        })}
      </div>
    </div>
  );
}
