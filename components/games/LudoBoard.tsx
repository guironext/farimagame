"use client";

import dynamic from "next/dynamic";
import { HOME, LUDO_COLORS, movableTokens, type LudoState } from "@/lib/games/ludo";
import { Button, cx } from "../ui";
import type { BoardProps } from "./types";

const LudoScene = dynamic(() => import("./LudoScene").then((m) => m.LudoScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#1a120c]" />,
});

const BG = ["bg-red-500", "bg-green-500", "bg-yellow-400", "bg-blue-500"];

export function LudoBoard({ table, state, mySeat, canPlay, busy, onMove }: BoardProps<LudoState>) {
  const turnColor = state.colors[state.turn];
  const actor = table.seats[state.turn];
  const actorCpu = !!actor?.isCpu;
  const last = state.lastRoll;
  const lastName = last ? table.seats[last.seat]?.username : null;
  const camps = table.seats.map((s) => {
    const color = state.colors[s.seat];
    const yours = s.seat === mySeat;
    const playing = !state.over && s.seat === state.turn;
    const who = yours ? "Vous" : s.isCpu ? "" : "Joueur";
    const action = state.phase === "roll" ? "lance le dé" : "choisit un pion";
    return {
      color,
      title: s.username,
      subtitle: playing ? `${who ? `${who} · ` : ""}${action}` : `Camp ${LUDO_COLORS[color]}${yours ? " · Vous" : ""}`,
      playing,
    };
  });
  const banner = state.over
    ? "Partie terminée"
    : state.phase === "roll"
      ? canPlay
        ? "À vous de lancer le dé"
        : actorCpu
          ? "L'ordinateur lance le dé"
          : `${actor?.username ?? "…"} lance le dé`
      : canPlay
        ? `Votre dé : ${state.dice}. Touchez le pion à avancer.`
        : actorCpu
          ? `Dé de l'ordinateur : ${state.dice}. Il déplace un pion.`
          : `${actor?.username ?? "…"} a fait ${state.dice} et choisit un pion.`;

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <div className="relative aspect-square overflow-hidden rounded-[28px] border border-amber-200/15 bg-[#1a120c] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
        <LudoScene state={state} mySeat={mySeat} canPlay={canPlay} busy={busy} rollerCpu={!!last && !!table.seats[last.seat]?.isCpu} onMove={onMove} camps={camps} />
        <div className={cx("pointer-events-none absolute left-3 right-3 top-3 z-10 rounded-2xl border px-3 py-2 text-center text-sm font-semibold shadow-lg", canPlay ? "border-emerald-300/40 bg-emerald-950/80 text-emerald-50" : actorCpu ? "border-amber-200/40 bg-amber-950/85 text-amber-50" : "border-white/15 bg-slate-950/80 text-white")}>
          <span className={cx("mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle", BG[turnColor])} />
          {banner}
        </div>
        <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] tracking-wide text-amber-100/70">
          Glissez pour tourner la table · molette pour zoomer
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cx("h-4 w-4 rounded-full", BG[turnColor])} />
          <span className="text-sm text-slate-300">
            {canPlay ? "Votre tour" : actorCpu ? "Tour de l'ordinateur" : `Tour de ${actor?.username ?? "…"}`}
            {" · "}camp {LUDO_COLORS[turnColor]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {last && (
            <span className="text-sm text-slate-300">
              Dé de <strong className="text-white">{lastName}</strong>
              <span
                key={`${state.moves}-${last.seat}-${last.value}-${table.version}`}
                className="ml-2 inline-grid h-12 w-12 place-items-center rounded-xl border border-white/15 bg-[#fbf7ef] text-2xl font-black text-slate-900 shadow-lg align-middle"
                title={`Dernier lancer de ${lastName} : ${last.value}`}
              >
                {last.value}
              </span>
            </span>
          )}
          {canPlay && state.phase === "roll" && (
            <Button onClick={() => onMove({ type: "roll" })} disabled={busy}>
              🎲 Lancer votre dé
            </Button>
          )}
          {canPlay && state.phase === "move" && state.dice != null && mySeat != null && (
            <div className="flex flex-wrap gap-2">
              {movableTokens(state, mySeat, state.dice).map((token) => {
                const pos = state.tokens[mySeat][token];
                const place = pos < 0 ? "base" : pos >= HOME ? "maison" : pos > 50 ? "couloir" : "parcours";
                return (
                  <Button key={token} onClick={() => onMove({ type: "move", token })} disabled={busy}>
                    Avancer le pion {token + 1} · {place}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {table.seats.map((s) => {
          const color = state.colors[s.seat];
          const home = state.tokens[s.seat]?.filter((p) => p === HOME).length ?? 0;
          const yours = s.seat === mySeat;
          const playing = !state.over && s.seat === state.turn;
          return (
            <span
              key={s.seat}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                playing ? "border-amber-300/70 bg-amber-300/10 text-amber-50" : "border-white/10",
                !s.active && "line-through opacity-50",
              )}
            >
              <span className={cx("h-2.5 w-2.5 rounded-full", BG[color])} />
              Camp {LUDO_COLORS[color]} · {yours ? "Vous" : s.username} · {home}/4 à la maison
            </span>
          );
        })}
      </div>
    </div>
  );
}
