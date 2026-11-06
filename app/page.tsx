import Link from "next/link";
import { FeaturedMatches } from "@/components/home/FeaturedMatches";
import { HomeCta } from "@/components/HomeCta";
import { IconChevronRight } from "@/components/icons";
import { LogoVideo } from "@/components/LogoVideo";
import { ButtonLink } from "@/components/ui";
import { GAME_LIST } from "@/lib/games/meta";
import { CORIS_PER_LION, FCFA_PER_LION, PRO_STAKE_LIONS, SIGNUP_BONUS_CORIS, STAKE_CORIS } from "@/lib/config";
import { COMPETITIONS } from "@/lib/sports/competitions";

export default function Home() {
  return (
    <div className="space-y-14 sm:space-y-20">
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative grid items-center gap-2 md:grid-cols-[1fr_1.05fr] md:gap-8 md:pt-6">
        <div className="relative order-1 -mx-4 md:order-2 md:mx-0">
          <div aria-hidden className="absolute inset-x-[15%] inset-y-[20%] -z-10 rounded-full bg-gradient-to-tr from-emerald-500/30 via-amber-400/10 to-rose-500/30 blur-3xl" />
          {/* La vidéo (16:9, fond sombre) est fondue dans la page par un masque radial */}
          <div className="animate-float mask-fade-edges mx-auto max-w-[360px] sm:max-w-[460px] md:max-w-none">
            <LogoVideo className="aspect-video h-auto w-full object-cover" />
          </div>
        </div>

        <div className="animate-fade-up order-2 text-center md:order-1 md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            {SIGNUP_BONUS_CORIS} Coris offerts à l&apos;inscription
          </span>
          <h1 className="mt-4 text-[2.6rem] font-black leading-[1.02] tracking-tight sm:text-6xl">
            Jouez. Pariez.
            <br />
            <span className="text-gradient-brand">Gagnez.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-slate-300 sm:text-lg md:mx-0">
            Ludo, Dames, Awalé, Échecs et paris sur le football africain et européen. Le gagnant empoche{" "}
            <strong className="text-white">80 % des mises</strong>.
          </p>
          <HomeCta />
          <dl className="mx-auto mt-7 grid max-w-md grid-cols-3 divide-x divide-white/10 rounded-2xl border border-line bg-white/[0.03] py-3 md:mx-0">
            <Stat value="4" label="jeux" />
            <Stat value="80 %" label="au gagnant" />
            <Stat value={String(COMPETITIONS.length)} label="compétitions" />
          </dl>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[1.75rem] border border-fuchsia-300/25 bg-[#140a22] px-5 py-6 shadow-2xl shadow-fuchsia-950/40 sm:px-8 sm:py-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-8 h-48 w-48 rounded-full bg-amber-400/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-200/70 to-transparent" />

        <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto] lg:gap-10">
          <div className="min-w-0 text-center lg:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-fuchsia-200">Niveau Pro</p>
            <h2 className="mx-auto mt-2 max-w-xl text-[1.7rem] font-black leading-[1.05] tracking-tight sm:text-4xl lg:mx-0">
              Passer Pro, c&apos;est
              <span className="mt-1 block bg-gradient-to-r from-amber-200 via-amber-100 to-fuchsia-200 bg-clip-text text-transparent">
                gagner de l&apos;argent
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base lg:mx-0">
              Convertissez vos Coris en Lions, jouez les parties Pro et retirez vos gains. Le vainqueur empoche{" "}
              <strong className="text-white">80&nbsp;% du pot</strong>.
            </p>
            <ul className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
              <li className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-100">Gratuit</li>
              <li className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100">
                {CORIS_PER_LION} Coris = 1 Lion
              </li>
              <li className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                1 Lion = {FCFA_PER_LION.toLocaleString("fr-FR")} F CFA
              </li>
            </ul>
          </div>

          <ButtonLink
            href="/pro"
            variant="pro"
            className="h-14 w-full rounded-2xl px-8 text-base shadow-lg shadow-fuchsia-900/50 lg:w-auto lg:min-w-52"
          >
            Passer Pro
          </ButtonLink>
        </div>
      </section>

      {/* ------------------------------------------------------------ Jeux */}
      <section>
        <SectionHeader eyebrow="Salon de jeu" title="Les jeux" href="/salon" linkLabel="Voir le salon" />
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0">
          {GAME_LIST.map((g, i) => (
            <Link
              key={g.id}
              href={`/salon?jeu=${g.id}`}
              style={{ animationDelay: `${i * 70}ms` }}
              className="surface animate-fade-up group w-[72%] shrink-0 snap-start overflow-hidden transition hover:-translate-y-1 hover:border-line-strong min-[480px]:w-[46%] sm:w-[40%] lg:w-auto"
            >
              <div className={`relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br ${g.color} sm:h-40`}>
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_90%,rgba(0,0,0,0.35),transparent_50%)]" />
                <div aria-hidden className="absolute -bottom-10 -right-6 h-32 w-32 rounded-full border-[14px] border-white/10" />
                <span className="relative text-7xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] transition duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  {g.emoji}
                </span>
                <span className="absolute left-3 top-3 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                  {STAKE_CORIS} 🐚 / partie
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold">{g.name}</h3>
                  <IconChevronRight className="h-5 w-5 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-amber-300" />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{g.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium">
                  <span className="rounded-full bg-white/[0.06] px-2 py-1 text-slate-300">🤖 vs ordinateur</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-1 text-slate-300">
                    👥 {g.modes.filter((m) => m !== "cpu").length > 1 ? `2 à ${g.modes.filter((m) => m !== "cpu").at(-1)} joueurs` : "2 joueurs"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ Paris sportifs */}
      <FeaturedMatches />

      {/* ------------------------------------------------------------ Comment ça marche */}
      <section>
        <SectionHeader eyebrow="Simple et transparent" title="Comment ça marche" />
        <ol className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <Step n={1} emoji="🎁" title="Inscrivez-vous" tone="amber">
            Recevez <strong className="text-white">{SIGNUP_BONUS_CORIS} Coris</strong> offerts dès la création de votre compte.
          </Step>
          <Step n={2} emoji="🎮" title="Jouez en Coris" tone="amber">
            {STAKE_CORIS} Coris par partie, contre l&apos;ordinateur ou à 2, 3 ou 4 joueurs.
          </Step>
          <Step n={3} emoji="🦁" title="Passez Pro" tone="fuchsia">
            Convertissez vos gains : {CORIS_PER_LION} Coris = 1 Lion. Partie Pro : {PRO_STAKE_LIONS} Lion.
          </Step>
          <Step n={4} emoji="⚽" title="Pariez en F CFA" tone="emerald">
            1 Lion = {FCFA_PER_LION.toLocaleString("fr-FR")} F CFA, ou déposez par Mobile Money pour parier.
          </Step>
        </ol>

        <div className="surface mt-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-center gap-1 text-[13px] font-semibold sm:justify-start sm:gap-2 sm:text-sm">
            <span className="rounded-full bg-amber-400/15 px-2.5 py-1.5 text-amber-200">🐚 {CORIS_PER_LION} Coris</span>
            <IconChevronRight className="h-3.5 w-3.5 text-slate-500" />
            <span className="rounded-full bg-fuchsia-400/15 px-2.5 py-1.5 text-fuchsia-200">🦁 1 Lion</span>
            <IconChevronRight className="h-3.5 w-3.5 text-slate-500" />
            <span className="rounded-full bg-emerald-400/15 px-2.5 py-1.5 text-emerald-200">{FCFA_PER_LION.toLocaleString("fr-FR")} F CFA</span>
          </div>
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-xs text-slate-400">
              <span>Sur chaque partie de jeu</span>
            </div>
            <div className="mt-2 flex h-11 overflow-hidden rounded-xl text-sm font-bold">
              <div className="bg-brand-gradient flex w-4/5 items-center justify-between px-3 text-slate-950">
                <span>Gagnant(s)</span>
                <span>80 %</span>
              </div>
              <div className="flex w-1/5 items-center justify-center bg-white/10 text-slate-200">20 %</div>
            </div>
            <div className="mt-1.5 flex justify-end text-[11px] text-slate-500">Maison</div>
            <p className="mt-3 text-xs text-slate-400">⚽ Paris sportifs : <strong className="text-emerald-300">90 %</strong> du pot aux gagnants, 10 % pour la maison.</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA final */}
      <HomeCta variant="banner" />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2 text-center">
      <dt className="sr-only">{label}</dt>
      <dd className="text-xl font-extrabold tabular-nums text-white sm:text-2xl">{value}</dd>
      <dd className="text-[11px] uppercase tracking-wider text-slate-400">{label}</dd>
    </div>
  );
}

function SectionHeader({ eyebrow, title, href, linkLabel }: { eyebrow: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 sm:mb-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/80">{eyebrow}</div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-amber-300 hover:text-amber-200">
          {linkLabel}
          <IconChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function Step({ n, emoji, title, tone, children }: { n: number; emoji: string; title: string; tone: "amber" | "fuchsia" | "emerald"; children: React.ReactNode }) {
  const ring = { amber: "from-amber-400/25", fuchsia: "from-fuchsia-400/25", emerald: "from-emerald-400/25" }[tone];
  return (
    <li className="surface relative flex flex-col gap-3 overflow-hidden p-3.5 sm:p-5">
      <div aria-hidden className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${ring} to-transparent blur-xl`} />
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-2xl sm:h-12 sm:w-12">
        {emoji}
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] font-extrabold text-amber-300 ring-1 ring-amber-400/40">
          {n}
        </span>
      </div>
      <div className="relative">
        <h3 className="text-[15px] font-bold sm:text-base">{title}</h3>
        <p className="mt-1 text-[13px] leading-snug text-slate-400 sm:text-sm">{children}</p>
      </div>
    </li>
  );
}
