"use client";

import Link from "next/link";
import { useSession } from "./SessionProvider";
import { cx } from "./ui";

const primary =
  "bg-brand-gradient inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-bold text-slate-950 shadow-glow transition hover:brightness-110 active:scale-[0.98]";
const ghost =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white/[0.05] px-5 text-[15px] font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]";

export function HomeCta({ variant = "hero" }: { variant?: "hero" | "banner" }) {
  const { me, loading, config } = useSession();
  const bonus = config?.SIGNUP_BONUS_CORIS ?? 500;

  if (variant === "banner") {
    return (
      <section className="relative overflow-hidden rounded-[1.75rem] border border-amber-400/20 bg-gradient-to-br from-amber-500/20 via-orange-600/10 to-violet-600/20 p-6 text-center sm:p-10 md:text-left">
        <div aria-hidden className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-5 md:flex-row md:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {me ? "Passez au niveau supérieur" : "Prêt à jouer ?"}
            </h2>
            <p className="mt-1 text-sm text-slate-300 sm:text-base">
              {me
                ? "Convertissez vos Coris en Lions et jouez les parties Pro."
                : `Créez votre compte en 30 secondes et recevez ${bonus} Coris offerts.`}
            </p>
          </div>
          {loading ? (
            <div className="skeleton h-12 w-56 rounded-2xl" />
          ) : (
            <Link href={me ? "/passer-pro" : "/inscription"} className={cx(primary, "w-full sm:w-auto")}>
              {me ? "🦁 Découvrir le niveau Pro" : `🎁 S'inscrire · ${bonus} Coris`}
            </Link>
          )}
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto mt-7 max-w-md space-y-2.5 md:mx-0" aria-hidden>
        <div className="skeleton h-12 rounded-2xl" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="skeleton h-12 rounded-2xl" />
          <div className="skeleton h-12 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (me) {
    return (
      <div className="mx-auto mt-7 max-w-md space-y-2.5 md:mx-0">
        <p className="text-sm text-slate-400">
          Bon retour, <strong className="text-white">{me.username}</strong> 👋
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/salon" className={primary}>
            🎮 Jouer
          </Link>
          <Link href="/portefeuille" className={ghost}>
            💳 Portefeuille
          </Link>
        </div>
        <Link href="/tableau-de-bord" className="inline-flex min-h-11 items-center text-sm font-medium text-slate-400 hover:text-white">
          Mon tableau de bord →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-7 max-w-md space-y-2.5 md:mx-0">
      <Link href="/inscription" className={cx(primary, "w-full")}>
        🎁 S&apos;inscrire · {bonus} Coris offerts
      </Link>
      <Link href="/salon" className={cx(ghost, "w-full")}>
        🎮 Voir les jeux
      </Link>
      <p className="pt-1 text-sm text-slate-400">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold text-amber-300 hover:text-amber-200">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
