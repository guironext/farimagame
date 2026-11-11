"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { course, replay, step, startRunner, type Obstacle, type RunAction, type RunState } from "@/lib/games/run";
import type { BoardProps } from "./types";

const LOOKAHEAD = 14;
const STRIPE = 40;

type Motion = {
  pos: number;
  lanePos: number;
  y: number;
  lean: number;
  sy: number;
  lift: number;
  legA: number;
  legB: number;
  armA: number;
  armB: number;
  crashed: boolean;
};

const standing = (): Motion => ({
  pos: 0,
  lanePos: 1,
  y: 0,
  lean: 6,
  sy: 1,
  lift: 0,
  legA: 0,
  legB: 0,
  armA: 0,
  armB: 0,
  crashed: false,
});

export function RunBoard({ table, state, mySeat, canPlay, busy, onMove }: BoardProps<RunState>) {
  const track = useMemo(() => course(state.seed), [state.seed]);
  const obstacles = useMemo(() => {
    const list: { tick: number; obstacle: Obstacle }[] = [];
    track.forEach((obstacle, tick) => {
      if (obstacle) list.push({ tick, obstacle });
    });
    return list;
  }, [track]);
  const recorded = mySeat != null ? state.scores[mySeat] : null;
  const [meter, setMeter] = useState(recorded ?? 0);
  const [crashed, setCrashed] = useState(false);
  const pending = useRef<RunAction>(".");
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const stageRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<HTMLDivElement>(null);
  const motion = useRef<Motion>(standing());
  const paintRef = useRef<() => void>(() => {});

  const paint = useCallback(() => {
    const m = motion.current;
    const road = roadRef.current;
    if (road) road.style.transform = `translate3d(0, ${(m.pos % 1) * STRIPE}px, 0)`;
    const runner = runnerRef.current;
    if (runner) {
      runner.style.left = `${4 + m.lanePos * 33}%`;
      runner.style.setProperty("--y", `${m.y}px`);
      runner.style.setProperty("--lean", `${m.lean}deg`);
      runner.style.setProperty("--sy", String(m.sy));
      runner.style.setProperty("--lift", String(m.lift));
      runner.style.setProperty("--leg-a", `${m.legA}deg`);
      runner.style.setProperty("--leg-b", `${m.legB}deg`);
      runner.style.setProperty("--arm-a", `${m.armA}deg`);
      runner.style.setProperty("--arm-b", `${m.armB}deg`);
    }
    const stage = stageRef.current;
    if (!stage) return;
    for (const el of stage.querySelectorAll<HTMLElement>("[data-tick]")) {
      const tick = Number(el.dataset.tick);
      const depth = tick - m.pos + 1;
      if (depth < -0.65 || depth > LOOKAHEAD) {
        el.style.visibility = "hidden";
        continue;
      }
      const near = 1 - depth / LOOKAHEAD;
      const fade = depth > LOOKAHEAD - 1.5 ? Math.max(0, (LOOKAHEAD - depth) / 1.5) : 1;
      el.style.visibility = "visible";
      el.style.bottom = `${10 + (depth / LOOKAHEAD) * 70}%`;
      el.style.opacity = String(Math.max(0, Math.min(1, fade)));
      el.style.transform = `scale(${0.74 + Math.max(0, near) * 0.26})`;
    }
  }, []);
  paintRef.current = paint;

  useLayoutEffect(() => {
    paintRef.current();
  });

  useEffect(() => {
    setMeter(recorded ?? 0);
    setCrashed(false);
    motion.current = standing();
    paintRef.current();
  }, [state.seed, state.moves, mySeat, recorded]);

  useEffect(() => {
    if (!canPlay) return;
    let runner = startRunner();
    let pos = 0;
    let next = 0;
    let lane = 1;
    let lanePos = 1;
    let jumpStart = -99;
    let slideStart = -99;
    let crashedNow = false;
    let sent = false;
    const taken: RunAction[] = [];
    pending.current = ".";
    let last = performance.now();
    let shown = 0;
    let frame = 0;
    let alive = true;

    const onKey = (e: KeyboardEvent) => {
      const action = keyAction(e.key);
      if (!action) return;
      pending.current = action;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);

    const publish = (nowLane: number) => {
      const visual = Math.max(0, pos - 1);
      const phase = visual * ((Math.PI * 2) / 1.15);
      const jumpU = (visual - jumpStart) / 3;
      const lift = jumpU > 0 && jumpU < 1 ? 4 * jumpU * (1 - jumpU) : 0;
      const crouch = crouchAmount(visual - slideStart);
      const sinceLand = visual - (jumpStart + 3);
      const squash = jumpStart > -90 && crouch < 0.12 && sinceLand >= 0 && sinceLand < 0.22 ? (1 - sinceLand / 0.22) * 0.16 : 0;
      const grounded = 1 - Math.min(1, lift * 1.6) - crouch * 0.85;
      const stride = Math.sin(phase) * 34 * Math.max(0, grounded);
      const tuck = lift * 20;
      const bob = crouch > 0.2 || lift > 0.05 ? 0 : Math.cos(phase * 2) * -5;
      motion.current = {
        pos,
        lanePos,
        y: -lift * 96 + bob,
        lean: (1 - crouch) * 5 + (nowLane - lanePos) * 22 - crouch * 46 + (crashedNow ? 16 : 0),
        sy: Math.max(0.55, 1 - crouch * 0.32 - squash),
        lift,
        legA: stride + tuck,
        legB: -stride + tuck * 0.45,
        armA: -stride * 0.82,
        armB: stride * 0.82,
        crashed: crashedNow,
      };
      paintRef.current();
    };

    const loop = (now: number) => {
      if (!alive) return;
      frame = requestAnimationFrame(loop);
      if (crashedNow) return;
      const dt = Math.min(32, Math.max(0, now - last));
      last = now;
      const pace = Math.max(112, 188 - Math.min(pos, 200) * 0.32);
      pos += dt / pace;
      lanePos += (lane - lanePos) * (1 - Math.exp(-dt / 48));
      while (pos >= next + 1 && !crashedNow) {
        const t = next;
        const action = pending.current;
        pending.current = ".";
        taken.push(action);
        const before = runner;
        const moved = step(track[t] ?? null, runner, action);
        if (action === "j" && before.jump === 0 && moved.runner.jump > 0) jumpStart = t;
        if (action === "s" && before.slide === 0 && moved.runner.slide > 0) slideStart = t;
        runner = moved.runner;
        lane = runner.lane;
        if (moved.crashed || t >= track.length - 1) {
          crashedNow = true;
          pos = t + 1;
          break;
        }
        next = t + 1;
      }
      publish(lane);
      const visual = Math.floor(Math.max(0, pos - 1));
      if (visual !== shown) {
        shown = visual;
        setMeter(crashedNow ? shown : visual);
      }
      if (!crashedNow || sent) return;
      sent = true;
      setCrashed(true);
      const result = replay(state.seed, taken);
      setMeter(result.distance);
      onMoveRef.current({ actions: taken });
    };

    publish(lane);
    frame = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [canPlay, state.seed, state.moves, track]);

  function press(action: RunAction) {
    pending.current = action;
  }

  const showRun = canPlay || crashed;

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Endless Run</div>
          <div className="text-3xl font-black tabular-nums text-white">{showRun && !crashed ? meter : recorded ?? meter} m</div>
        </div>
        <p className="max-w-[14rem] text-right text-xs text-slate-400">
          {canPlay && !crashed ? "Haut sauter, bas glisser, côtés changer de voie." : "Même piste pour les deux coureurs. Le plus loin gagne."}
        </p>
      </div>

      <div
        ref={stageRef}
        className="relative h-[min(460px,calc(100dvh-18rem))] min-h-72 overflow-hidden rounded-[1.6rem] border border-cyan-300/20 bg-[#07101c] shadow-2xl shadow-cyan-950/40"
      >
        <div
          ref={roadRef}
          aria-hidden
          className="absolute inset-x-0 h-[calc(100%+40px)] opacity-80"
          style={{
            top: -STRIPE,
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0 36px, rgba(103,232,249,0.2) 36px 40px), linear-gradient(90deg, transparent 0 32%, rgba(255,255,255,0.1) 32% 33.1%, transparent 33.1% 66.9%, rgba(255,255,255,0.1) 66.9% 68%, transparent 68%)",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-fuchsia-500/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-6 bottom-[9%] h-px bg-cyan-200/10" />
        {showRun &&
          obstacles.map(({ tick, obstacle }) => (
            <div
              key={tick}
              data-tick={tick}
              aria-hidden
              className="invisible absolute w-[30%] rounded-xl border"
              style={{
                left: `${4 + obstacle.lane * 33}%`,
                height: obstacle.kind === "high" ? 26 : obstacle.kind === "block" ? 76 : 46,
                background:
                  obstacle.kind === "low"
                    ? "linear-gradient(#fbbf24,#b45309)"
                    : obstacle.kind === "high"
                      ? "linear-gradient(#e879f9,#6b21a8)"
                      : "linear-gradient(#fb7185,#9f1239)",
                borderColor: "rgba(255,255,255,0.35)",
                transformOrigin: "50% 100%",
              }}
            />
          ))}
        {showRun && <RunnerFigure ref={runnerRef} burst={crashed} />}
        {!canPlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 p-6 text-center">
            <div>
              <div className="text-lg font-bold">{state.over ? "Course terminée" : "L'autre coureur est sur la piste"}</div>
              <div className="mt-2 text-sm text-slate-300">
                {state.scores.map((score, seat) => `${table.seats[seat]?.username ?? `Place ${seat + 1}`} : ${score == null ? "—" : `${score} m`}`).join(" · ")}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <Touch label="Gauche" onPress={() => press("l")} disabled={!canPlay || crashed || busy} />
        <Touch label="Sauter" onPress={() => press("j")} disabled={!canPlay || crashed || busy} />
        <Touch label="Glisser" onPress={() => press("s")} disabled={!canPlay || crashed || busy} />
        <Touch label="Droite" onPress={() => press("r")} disabled={!canPlay || crashed || busy} />
      </div>
    </div>
  );
}

function crouchAmount(u: number) {
  if (u < 0 || u > 2) return 0;
  if (u < 0.2) return ease(u / 0.2);
  if (u > 1.74) return 1 - ease((u - 1.74) / 0.26);
  return 1;
}

function ease(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function RunnerFigure({ burst, ref }: { burst: boolean; ref: Ref<HTMLDivElement> }) {
  return (
  <div ref={ref} className="absolute bottom-[8%] z-10 w-[30%]">
    <div className="relative mx-auto h-24 w-16">
      <span
        aria-hidden
        className="absolute bottom-0 left-1/2 h-2 w-11 rounded-full bg-black/50 blur-[1px]"
        style={{ opacity: "calc(0.55 - var(--lift) * 0.35)", transform: "translateX(-50%) scaleX(calc(1 - var(--lift) * 0.45))" }}
      />
      <div className="absolute inset-0" style={{ transformOrigin: "50% 90%", transform: "translateY(var(--y)) rotate(var(--lean)) scaleY(var(--sy))" }}>
        <Limb color="#cbd5e1" length="2.15rem" bottom="0.1rem" offset={-7} variable="--leg-a" behind />
        <Limb color="#fcd34d" length="1.45rem" bottom="2.45rem" offset={-9} variable="--arm-a" behind />
        <span className="absolute bottom-8 left-1/2 h-10 w-5 -translate-x-1/2 rounded-t-xl rounded-b-md bg-cyan-300" />
        <Limb color="#e2e8f0" length="2.15rem" bottom="0.1rem" offset={2} variable="--leg-b" />
        <Limb color="#fde68a" length="1.45rem" bottom="2.45rem" offset={5} variable="--arm-b" />
        <span className="absolute bottom-[4.25rem] left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-amber-200 shadow-[inset_-4px_-2px_0_rgba(180,83,9,0.28)]">
          <span className="absolute right-1.5 top-2 h-1 w-1 rounded-full bg-slate-900" />
        </span>
      </div>
      {burst && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-4xl">💥</span>}
    </div>
  </div>
  );
}

function Limb({
  color,
  length,
  bottom,
  offset,
  variable,
  behind,
}: {
  color: string;
  length: string;
  bottom: string;
  offset: number;
  variable: string;
  behind?: boolean;
}) {
  return (
    <span
      aria-hidden
      className="absolute left-1/2 w-[5px] rounded-full"
      style={{
        height: length,
        bottom,
        background: color,
        zIndex: behind ? 0 : 2,
        transformOrigin: "top center",
        transform: `translateX(${offset}px) rotate(var(${variable}))`,
      }}
    />
  );
}

function keyAction(key: string): RunAction | null {
  if (key === "ArrowLeft" || key === "a" || key === "A" || key === "q" || key === "Q") return "l";
  if (key === "ArrowRight" || key === "d" || key === "D") return "r";
  if (key === "ArrowUp" || key === "w" || key === "W" || key === "z" || key === "Z" || key === " ") return "j";
  if (key === "ArrowDown" || key === "s" || key === "S") return "s";
  return null;
}

function Touch({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="rounded-2xl border border-white/10 bg-white/[0.06] py-3 text-sm font-bold text-white disabled:opacity-40"
    >
      {label}
    </button>
  );
}
