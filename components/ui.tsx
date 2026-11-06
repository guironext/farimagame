"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { fmtAmount } from "@/lib/client";
import type { Currency } from "@/lib/types";
import { useSession } from "./SessionProvider";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20 backdrop-blur", className)}>
      {children}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "pro" };

export function Button({ variant = "primary", className, ...props }: BtnProps) {
  const styles = {
    primary: "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-110",
    pro: "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:brightness-110",
    ghost: "border border-white/15 bg-white/5 text-white hover:bg-white/10",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
  }[variant];
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
    />
  );
}

export function ButtonLink({ href, children, variant = "primary", className }: { href: string; children: React.ReactNode; variant?: BtnProps["variant"]; className?: string }) {
  const styles = {
    primary: "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-110",
    pro: "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:brightness-110",
    ghost: "border border-white/15 bg-white/5 text-white hover:bg-white/10",
    danger: "bg-rose-600 text-white",
  }[variant];
  return (
    <Link href={href} className={cx("inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition", styles, className)}>
      {children}
    </Link>
  );
}

export function Money({ amount, currency, className, signed }: { amount: number; currency: Currency; className?: string; signed?: boolean }) {
  const sign = signed && amount > 0 ? "+" : "";
  if (currency === "fcfa") {
    return (
      <span className={cx("inline-flex items-baseline gap-1 font-semibold tabular-nums", className)}>
        {sign}
        {fmtAmount(amount)} <span className="text-[0.7em] font-bold tracking-wide opacity-80">F CFA</span>
      </span>
    );
  }
  const icon = currency === "coris" ? "🐚" : "🦁";
  return (
    <span className={cx("inline-flex items-center gap-1 font-semibold tabular-nums", className)}>
      {sign}
      {fmtAmount(amount)} <span aria-hidden>{icon}</span>
      <span className="sr-only">{currency === "coris" ? "Coris" : "Lions"}</span>
    </span>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
    </div>
  );
}

export function Alert({ children, kind = "error" }: { children: React.ReactNode; kind?: "error" | "info" | "success" }) {
  const s = {
    error: "border-rose-500/40 bg-rose-500/10 text-rose-200",
    info: "border-sky-500/40 bg-sky-500/10 text-sky-200",
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  }[kind];
  return <div className={cx("rounded-xl border px-4 py-3 text-sm", s)}>{children}</div>;
}

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      {label}
    </div>
  );
}

/** Message affiché aux joueurs non administrateurs sur les pages protégées. */
export function AdminOnly() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="text-5xl">🔒</div>
      <h1 className="mt-4 text-2xl font-bold">Accès réservé</h1>
      <p className="mt-2 text-sm text-slate-400">Cette page est réservée à la Maison et aux administrateurs de FarimaGame.</p>
      <ButtonLink href="/tableau-de-bord" variant="ghost" className="mt-6">
        Retour au tableau de bord
      </ButtonLink>
    </div>
  );
}

/** Onglets / filtres en forme de pastilles. */
export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { id: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cx("flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]", className)}>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={cx(
            "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
            value === it.id ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Redirige vers /connexion si l'utilisateur n'est pas connecté. */
export function useRequireAuth() {
  const s = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!s.loading && !s.me) router.replace(`/connexion?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [s.loading, s.me, router]);
  return s;
}

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30";
