"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { course, cpuPlan, RACE_FINISH, replay, startCar, step, type RaceAction, type RaceState } from "@/lib/games/race";
import type { RaceCarView, RaceMotion } from "./RaceScene";
import type { BoardProps } from "./types";

const RaceScene = dynamic(() => import("./RaceScene").then((m) => m.RaceScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#07111c]" />,
});

const TICK = 0.2;

const IDLE: RaceCarView = { pos: 0, lane: 1, speed: 1, shake: 0, braking: false };

export function RaceBoard({ table, state, mySeat, canPlay, busy, onMove }: BoardProps<RaceState>) {
  const motion = useRef<RaceMotion>({ you: { ...IDLE }, rival: { ...IDLE } });
  const onMoveRef = useRef(onMove);
  const pendingRef = useRef<RaceAction | null>(null);
  onMoveRef.current = onMove;
  const seat = mySeat === 1 ? 1 : 0;
  const rivalSeat = (seat === 0 ? 1 : 0) as 0 | 1;
  const rivalCpu = !!table.seats[rivalSeat]?.isCpu;
  const rivalName = rivalCpu ? "Ordinateur" : table.seats[rivalSeat]?.username ?? "Adversaire";
  const rivalActions = useMemo(() => {
    if (rivalCpu) return cpuPlan(state.seed);
    return state.runs?.[rivalSeat] ?? null;
  }, [rivalCpu, rivalSeat, state.seed, state.runs]);
  const rivalActionsRef = useRef(rivalActions);
  const rivalNameRef = useRef(rivalName);
  rivalActionsRef.current = rivalActions;
  rivalNameRef.current = rivalName;
  const [hud, setHud] = useState({ you: 0, rival: 0, speed: 1, hits: 0, sent: false, lead: "Côte à côte" });
  const hazards = useMemo(() => {
    const track = course(state.seed);
    return track.flatMap((hazard, meter) => (hazard ? [{ meter, hazard }] : []));
  }, [state.seed]);

  useEffect(() => {
    if (!canPlay) return;
    const track = course(state.seed);
    let index = 0;
    let clock = 0;
    let nextAt = TICK;
    let sent = false;
    let applied: RaceAction[] | null = null;
    const you = { car: startCar(), fromPos: 0, hits: 0, actions: [] as RaceAction[], done: false, finishTick: 0, shake: 0, brakeUntil: 0 };
    const rival = { car: startCar(), fromPos: 0, done: false, finishTick: 0, shake: 0, brakeUntil: 0 };
    pendingRef.current = null;

    const adoptPlan = () => {
      const plan = rivalActionsRef.current;
      if (plan === applied) return;
      applied = plan;
      if (!plan) return;
      let car = startCar();
      for (let i = 0; i < index && car.pos < RACE_FINISH; i += 1) {
        car = step(track, car, plan[i] ?? ".").car;
      }
      if (car.pos > RACE_FINISH) car = { ...car, pos: RACE_FINISH };
      rival.car = car;
      rival.fromPos = car.pos;
      rival.done = car.pos >= RACE_FINISH;
      if (rival.done) rival.finishTick = index;
    };

    const openTick = () => {
      you.fromPos = you.car.pos;
      if (!you.done) {
        const action = pendingRef.current ?? ".";
        pendingRef.current = null;
        if (action === "-") you.brakeUntil = performance.now() + 280;
        const moved = step(track, you.car, action);
        you.actions.push(action);
        you.car = moved.car;
        if (moved.hit) {
          you.hits += 1;
          you.shake = 1;
        }
        if (you.car.pos >= RACE_FINISH) {
          you.car = { ...you.car, pos: RACE_FINISH };
          you.done = true;
          you.finishTick = you.actions.length;
        }
      }
      rival.fromPos = rival.car.pos;
      const plan = rivalActionsRef.current;
      if (plan && !rival.done) {
        const action = plan[index] ?? ".";
        if (action === "-") rival.brakeUntil = performance.now() + 280;
        const moved = step(track, rival.car, action);
        rival.car = moved.car;
        if (moved.hit) rival.shake = 1;
        if (rival.car.pos >= RACE_FINISH) {
          rival.car = { ...rival.car, pos: RACE_FINISH };
          rival.done = true;
          rival.finishTick = index + 1;
        }
      }
      index += 1;
    };

    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const action: RaceAction | null =
        key === "arrowleft" || key === "q" || key === "a" ? "l" : key === "arrowright" || key === "d" ? "r" : key === "arrowup" || key === "w" || key === "z" || key === " " ? "+" : key === "arrowdown" || key === "s" ? "-" : null;
      if (!action) return;
      event.preventDefault();
      pendingRef.current = action;
    };
    window.addEventListener("keydown", onKey);

    let last = performance.now();
    let raf = 0;
    let shown = { you: 0, rival: 0, speed: 1, hits: 0, sent: false, lead: "Côte à côte" };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(32, now - last) / 1000;
      last = now;
      adoptPlan();
      clock += dt;
      if (!sent) {
        let guard = 0;
        while (clock >= nextAt && guard < 4 && !(you.done && (rival.done || !rivalActionsRef.current))) {
          openTick();
          nextAt += TICK;
          guard += 1;
        }
      }
      const frac = index === 0 ? 0 : Math.min(1, Math.max(0, (clock - (nextAt - TICK)) / TICK));
      if (!sent && you.done && (rival.done || !rivalActionsRef.current) && frac >= 0.98) {
        sent = true;
        const result = replay(state.seed, you.actions);
        if (result.finished) onMoveRef.current({ actions: you.actions });
      }
      const youVisual = you.done && frac > 0.98 ? RACE_FINISH : you.fromPos + (you.car.pos - you.fromPos) * frac;
      const rivalVisual = rival.done && frac > 0.98 ? RACE_FINISH : rival.fromPos + (rival.car.pos - rival.fromPos) * frac;
      you.shake = Math.max(0, you.shake - dt * 1.8);
      rival.shake = Math.max(0, rival.shake - dt * 1.8);
      const name = rivalNameRef.current;
      const youArrived = youVisual >= RACE_FINISH - 0.05;
      const rivalArrived = rivalVisual >= RACE_FINISH - 0.05;
      const lead =
        youArrived && rivalArrived
          ? you.finishTick < rival.finishTick
            ? "Vous arrivez en premier"
            : you.finishTick > rival.finishTick
              ? `${name} arrive en premier`
              : "Arrivée simultanée"
          : youArrived
            ? "Vous arrivez en premier"
            : rivalArrived
              ? `${name} arrive en premier`
              : youVisual > rivalVisual + 0.8
                ? "Vous menez"
                : rivalVisual > youVisual + 0.8
                  ? `${name} mène`
                  : "Côte à côte";
      motion.current = {
        you: { pos: Math.max(0, youVisual), lane: you.car.lane, speed: you.car.speed, shake: you.shake, braking: now < you.brakeUntil },
        rival: { pos: Math.max(0, rivalVisual), lane: rival.car.lane, speed: rival.car.speed, shake: rival.shake, braking: now < rival.brakeUntil },
      };
      const next = {
        you: Math.min(RACE_FINISH, Math.floor(Math.max(0, youVisual))),
        rival: Math.min(RACE_FINISH, Math.floor(Math.max(0, rivalVisual))),
        speed: you.car.speed,
        hits: you.hits,
        sent,
        lead,
      };
      if (next.you !== shown.you || next.rival !== shown.rival || next.speed !== shown.speed || next.hits !== shown.hits || next.sent !== shown.sent || next.lead !== shown.lead) {
        shown = next;
        setHud(shown);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [canPlay, state.seed, state.moves]);

  const mine = mySeat != null ? state.scores[mySeat] : null;

  const place = hud.you === hud.rival ? "–" : hud.you > hud.rival ? "1" : "2";
  const disabled = !canPlay || busy || hud.sent;

  return (
    <div className="mx-auto w-full max-w-3xl pb-[calc(var(--tabbar-h)+var(--safe-bottom)+4.75rem)] xl:pb-0">
      <div className="relative h-[min(62vw,calc(100dvh-15.5rem))] min-h-[260px] max-h-[520px] overflow-hidden rounded-[28px] border border-amber-200/20 bg-[#07111c] shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_30px_80px_-28px_rgba(0,0,0,0.85)] xl:h-[500px]">
        <RaceScene motion={motion} hazards={hazards} />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(5,8,18,0.62)_100%)]" />
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">Course auto</div>
            <div className="mt-1.5 space-y-1 text-sm font-black leading-none">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]" />
                <span>Vous</span>
                <span className="tabular-nums text-slate-300">{hud.you} m</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.9)]" />
                <span>{rivalName}</span>
                <span className="tabular-nums text-slate-300">{hud.rival} m</span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200/20 bg-slate-950/70 px-3 py-2 text-right text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">Place</div>
            <div className="text-2xl font-black leading-none text-amber-300">{place}</div>
            <div className="mt-1 flex justify-end gap-1">
              {[1, 2, 3].map((level) => (
                <span key={level} className={`h-1.5 w-3 rounded-full ${level <= hud.speed ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" : "bg-white/15"}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-200">
            <span>{hud.sent ? "Arrivée enregistrée…" : canPlay ? hud.lead : state.over ? "Course terminée" : "Les deux voitures se placent"}</span>
            <span>Chocs {hud.hits}</span>
          </div>
          <Meter name="Vous" meter={hud.you} bar="bg-gradient-to-r from-rose-400 to-amber-300" />
          <div className="mt-1">
            <Meter name={rivalCpu ? "Ordi" : rivalName} meter={hud.rival} bar="bg-gradient-to-r from-sky-400 to-blue-600" />
          </div>
        </div>
        {!canPlay && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050814]/55 p-6 text-center backdrop-blur-[2px]">
            <div className="max-w-sm rounded-3xl border border-amber-200/20 bg-slate-950/80 px-5 py-4 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.8)]">
              <div className="text-lg font-bold text-white">{state.over ? "Course terminée" : mine ? "Votre arrivée est enregistrée" : "Les pilotes se placent"}</div>
              <div className="mt-2 text-sm text-slate-200">
                {state.over ? (state.draw ? "Même temps à la ligne." : `${table.seats[state.winner ?? 0]?.username ?? "Le premier"} arrive le premier.`) : "Le premier à la ligne gagne."}
              </div>
              <div className="mt-2 text-sm text-slate-300">
                {state.scores
                  .map((score, index) => {
                    const name = table.seats[index]?.username ?? `Place ${index + 1}`;
                    return `${name} : ${score == null ? "en course" : `arrivée en ${score.time}`}`;
                  })
                  .join(" · ")}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="bottom-above-tabbar fixed inset-x-0 z-30 grid grid-cols-4 gap-2 px-3 xl:static xl:z-auto xl:mt-3 xl:grid-cols-4 xl:px-0">
        <RaceButton action="l" label="Gauche" tone="steer" className="order-1" disabled={disabled} onPress={(action) => (pendingRef.current = action)} />
        <RaceButton action="r" label="Droite" tone="steer" className="order-4" disabled={disabled} onPress={(action) => (pendingRef.current = action)} />
        <RaceButton action="-" label="Freiner" tone="brake" className="order-2" disabled={disabled} onPress={(action) => (pendingRef.current = action)} />
        <RaceButton action="+" label="Accélérer" tone="gas" className="order-3" disabled={disabled} onPress={(action) => (pendingRef.current = action)} />
      </div>
      <p className="mt-2 hidden text-center text-[11px] text-slate-500 xl:block">Flèches, ZQSD ou WASD. Espace pour accélérer. Les deux voitures partent ensemble : le premier à la ligne gagne.</p>
    </div>
  );
}

function Meter({ name, meter, bar }: { name: string; meter: number; bar: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 truncate text-[10px] font-semibold text-slate-300">{name}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${(meter / RACE_FINISH) * 100}%` }} />
      </div>
    </div>
  );
}

function RaceButton({
  action,
  label,
  tone,
  className,
  disabled,
  onPress,
}: {
  action: RaceAction;
  label: string;
  tone: "steer" | "brake" | "gas";
  className?: string;
  disabled: boolean;
  onPress: (action: RaceAction) => void;
}) {
  const toneClass =
    tone === "gas"
      ? "border-amber-200/50 bg-gradient-to-b from-amber-300 to-orange-500 text-slate-950 shadow-[0_10px_24px_-14px_rgba(251,191,36,0.95)]"
      : tone === "brake"
        ? "border-rose-300/30 bg-rose-500/15 text-rose-50"
        : "border-white/10 bg-white/[0.06] text-white";
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        if (!disabled) onPress(action);
      }}
      className={`min-h-12 rounded-2xl border px-1 text-xs font-bold transition active:scale-[0.98] disabled:opacity-40 sm:text-sm ${toneClass} ${className ?? ""}`}
    >
      {label}
    </button>
  );
}
