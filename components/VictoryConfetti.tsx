"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#fbbf24", "#f59e0b", "#f97316", "#34d399", "#38bdf8", "#f472b6", "#f8fafc", "#a78bfa"];

type Bit = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
};

function launch(bits: Bit[], width: number, height: number) {
  const origins: [number, number][] = [
    [width * 0.5, height * 0.38],
    [width * 0.18, height * 0.62],
    [width * 0.82, height * 0.62],
  ];
  for (const [ox, oy] of origins) {
    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 9;
      bits.push({
        x: ox,
        y: oy,
        w: 7 + Math.random() * 8,
        h: 4 + Math.random() * 5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.28,
        color: COLORS[i % COLORS.length],
      });
    }
  }
}

/** Confettis de victoire, avec le nom du joueur qui empoche 80 % du pot. */
export function VictoryConfetti({ name, onDone }: { name: string; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const bits: Bit[] = [];
    let last = performance.now();

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const extra: number[] = [];
    if (!reduced) {
      launch(bits, window.innerWidth, window.innerHeight);
      for (const delay of [450, 900, 1400, 2000]) {
        extra.push(window.setTimeout(() => launch(bits, window.innerWidth, window.innerHeight), delay));
      }
    }
    const hide = window.setTimeout(() => doneRef.current(), reduced ? 2800 : 7000);
    window.addEventListener("resize", fit);

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 2);
      last = now;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = bits.length - 1; i >= 0; i--) {
        const bit = bits[i];
        bit.vy += 0.08 * dt;
        bit.x += bit.vx * dt;
        bit.y += bit.vy * dt;
        bit.rot += bit.vr * dt;
        bit.vx *= 0.995;
        if (bit.y > window.innerHeight + 40) {
          bits.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(bit.x, bit.y);
        ctx.rotate(bit.rot);
        ctx.fillStyle = bit.color;
        ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hide);
      for (const id of extra) window.clearTimeout(id);
      window.removeEventListener("resize", fit);
    };
  }, [name]);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label={`Victoire de ${name}`}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
        <div className="pointer-events-auto w-full max-w-sm rounded-3xl border border-amber-300/50 bg-slate-950/90 px-6 py-6 text-center shadow-2xl shadow-amber-500/20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Victoire</p>
          <p className="mt-2 text-3xl font-black text-white">{name}</p>
          <p className="mt-2 text-sm text-emerald-300">empoche 80 %</p>
          <button
            type="button"
            onClick={onDone}
            className="mt-5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
