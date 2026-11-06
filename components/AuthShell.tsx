// Mise en page des écrans de connexion / inscription (le formulaire lui-même est fourni par Clerk).
import Link from "next/link";
import { SIGNUP_BONUS_CORIS, STAKE_CORIS } from "@/lib/config";

const PERKS = [
  { icon: "🎁", title: `${SIGNUP_BONUS_CORIS} Coris offerts`, text: "crédités automatiquement à la création du compte" },
  { icon: "🎲", title: "Ludo, Dames, Awalé, Échecs", text: `contre l'ordinateur ou entre amis, ${STAKE_CORIS} Coris la partie` },
  { icon: "⚽", title: "Paris sportifs", text: "ligues européennes, Ligue des champions, matchs africains" },
  { icon: "🔒", title: "Compte sécurisé", text: "connexion protégée par Clerk (e-mail, mot de passe, Google…)" },
];

export function AuthShell({ mode, children }: { mode: "login" | "register"; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-12">
      <section className="order-2 lg:order-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">FarimaGame</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-4xl">
          {mode === "login" ? (
            <>
              Bon retour <span className="text-gradient-brand">parmi nous</span>
            </>
          ) : (
            <>
              Jouez. Pariez. <span className="text-gradient-brand">Gagnez.</span>
            </>
          )}
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-400 sm:text-base">
          {mode === "login"
            ? "Retrouvez vos parties, vos paris et vos portefeuilles Coris, Lions et F CFA."
            : "Créez votre compte joueur en quelques secondes et recevez vos Coris de bienvenue."}
        </p>
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
          {PERKS.map((p) => (
            <li key={p.title} className="surface flex items-start gap-3 p-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg" aria-hidden>
                {p.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold">{p.title}</span>
                <span className="block text-xs text-slate-400">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-slate-400">
          {mode === "login" ? (
            <>
              Pas encore de compte ?{" "}
              <Link href="/inscription" className="font-semibold text-amber-300 hover:text-amber-200">
                Inscrivez-vous
              </Link>
            </>
          ) : (
            <>
              Déjà inscrit ?{" "}
              <Link href="/connexion" className="font-semibold text-amber-300 hover:text-amber-200">
                Connectez-vous
              </Link>
            </>
          )}
        </p>
      </section>
      <section className="order-1 flex min-h-[26rem] justify-center lg:order-2">{children}</section>
    </div>
  );
}

export function AuthSkeleton() {
  return <div className="skeleton h-[26rem] w-full max-w-[26rem] rounded-2xl" aria-hidden />;
}

/** Affiché en production quand les clés Clerk ne sont pas configurées. */
export function AuthUnavailable() {
  return (
    <div className="surface w-full max-w-[26rem] p-6 text-sm text-slate-300">
      <h2 className="text-lg font-bold text-white">Connexion momentanément indisponible</h2>
      <p className="mt-2">
        L&apos;administrateur doit renseigner les clés Clerk (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY et CLERK_SECRET_KEY) dans
        .env.local puis relancer le serveur.
      </p>
    </div>
  );
}
