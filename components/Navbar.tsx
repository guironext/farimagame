"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/client";
import { useSession } from "./SessionProvider";
import {
  IconBall,
  IconChart,
  IconChevronDown,
  IconCrown,
  IconGamepad,
  IconHome,
  IconLogout,
  IconShield,
  IconTicket,
  IconUser,
  IconWallet,
} from "./icons";
import { Money, cx } from "./ui";

/** Lien actif : correspondance exacte pour "/", sinon préfixe (sans que /paris active /paris/mes-paris). */
function isActive(pathname: string | null, href: string, exact?: boolean) {
  if (!pathname) return false;
  if (href === "/" || exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

const noopSubscribe = () => () => {};
/**
 * Session visible uniquement après hydratation : les zones sous <Suspense> peuvent s'hydrater
 * après le chargement de la session ; on rend d'abord exactement le HTML du serveur (déconnecté).
 */
function useHydratedSession() {
  const s = useSession();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return hydrated ? s.me : null;
}

const DESKTOP_LINKS = [
  { href: "/salon", label: "Jeux" },
  { href: "/paris", label: "Paris sportifs" },
  { href: "/paris/mes-paris", label: "Mes paris", auth: true },
  { href: "/portefeuille", label: "Portefeuille", auth: true },
  { href: "/pro", label: "Niveau Pro", auth: true },
];

export function Navbar() {
  return (
    <>
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-[var(--header-h)] max-w-6xl items-center justify-between gap-3 px-4 xl:h-16">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="FarimaGame – accueil">
            <Image src="/logo.png" alt="" width={40} height={40} className="h-9 w-9 rounded-xl ring-1 ring-white/10 xl:h-10 xl:w-10" priority />
            <span className="text-base font-extrabold tracking-tight max-[379px]:hidden sm:text-lg">
              Farima<span className="text-brand">Game</span>
            </span>
          </Link>

          <Suspense fallback={<DesktopNav pathname={null} />}>
            <DesktopNavWithPath />
          </Suspense>

          <AccountArea />
        </div>
      </header>

      <Suspense fallback={<BottomTabBar pathname={null} />}>
        <BottomTabBarWithPath />
      </Suspense>
    </>
  );
}

// ---------------------------------------------------------------- navigation bureau
function DesktopNavWithPath() {
  return <DesktopNav pathname={usePathname()} />;
}

function DesktopNav({ pathname }: { pathname: string | null }) {
  const me = useHydratedSession();
  const links = DESKTOP_LINKS.filter((l) => !l.auth || me);
  return (
    <nav className="hidden items-center gap-1 xl:flex" aria-label="Navigation principale">
      {links.map((l) => {
        const active = l.href === "/paris" ? isActive(pathname, "/paris") && !isActive(pathname, "/paris/mes-paris") : isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition",
              active ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            {l.label}
            {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brand-gradient" />}
          </Link>
        );
      })}
      {me?.role === "ADMIN" && (
        <Link
          href="/admin/paris"
          className={cx(
            "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition",
            isActive(pathname, "/admin") || isActive(pathname, "/maison") ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
          )}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------- soldes + menu compte
function AccountArea() {
  const { me, loading, setMe } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await api("/api/auth/logout", {}).catch(() => {});
    setMe(null);
    setOpen(false);
    router.push("/");
  }

  if (loading) return <div className="skeleton h-10 w-28 rounded-full" aria-hidden />;

  if (!me) {
    return (
      <div className="flex items-center gap-1.5">
        <Link href="/connexion" className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-slate-300 hover:text-white">
          Connexion
        </Link>
        <Link
          href="/inscription"
          className="bg-brand-gradient inline-flex h-10 items-center rounded-xl px-4 text-sm font-bold text-slate-950 shadow-glow-sm transition hover:brightness-110"
        >
          S&apos;inscrire
        </Link>
      </div>
    );
  }

  const isAdmin = me.role === "ADMIN";
  const menu = [
    { href: "/tableau-de-bord", label: "Tableau de bord", icon: IconChart },
    { href: "/portefeuille", label: "Portefeuille", icon: IconWallet },
    { href: "/paris/mes-paris", label: "Mes paris", icon: IconTicket },
    { href: "/pro", label: me.level === "pro" ? "Niveau Pro (actif)" : "Passer Pro", icon: IconCrown },
    ...(isAdmin
      ? [
          { href: "/admin/paris", label: "Admin paris", icon: IconShield },
          { href: "/maison", label: "La Maison", icon: IconShield },
        ]
      : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-full border border-line bg-white/[0.04] pl-1.5 pr-2.5 text-sm transition hover:border-line-strong"
      >
        <span className="bg-brand-gradient flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold uppercase text-slate-950">
          {me.username.slice(0, 1)}
        </span>
        <span className="flex items-center gap-2 text-[13px] leading-none">
          <Money amount={me.coris} currency="coris" className="text-amber-300" />
          {me.level === "pro" && <Money amount={me.lions} currency="lions" className="hidden text-fuchsia-300 sm:inline-flex" />}
          <span className="h-3.5 w-px bg-white/15" />
          <span className="font-semibold tabular-nums text-emerald-300">
            {me.fcfa.toLocaleString("fr-FR")} <span className="text-[0.8em] opacity-80">F</span>
          </span>
        </span>
        <IconChevronDown className={cx("h-4 w-4 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div role="menu" className="surface animate-fade-in absolute right-0 top-12 z-50 w-72 overflow-hidden bg-surface p-2 shadow-2xl">
          <div className="px-3 pb-3 pt-2">
            <div className="text-sm font-semibold">{me.username}</div>
            <div className="text-xs text-slate-400">
              {me.level === "pro" ? "Joueur Pro 🦁" : "Joueur"}
              {isAdmin && " · Administrateur"}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 px-1 pb-2">
            <Balance label="Coris" className="text-amber-300">
              <Money amount={me.coris} currency="coris" />
            </Balance>
            <Balance label="Lions" className="text-fuchsia-300">
              <Money amount={me.lions} currency="lions" />
            </Balance>
            <Balance label="F CFA" className="text-emerald-300">
              {me.fcfa.toLocaleString("fr-FR")}
            </Balance>
          </div>
          <div className="border-t border-line pt-1">
            {menu.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-200 hover:bg-white/5"
              >
                <m.icon className="h-[18px] w-[18px] text-slate-400" />
                {m.label}
              </Link>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-rose-300 hover:bg-rose-500/10"
            >
              <IconLogout className="h-[18px] w-[18px]" />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Balance({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-2 py-2 text-center">
      <div className={cx("truncate text-sm font-bold tabular-nums", className)}>{children}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------- barre d'onglets mobile
function BottomTabBarWithPath() {
  return <BottomTabBar pathname={usePathname()} />;
}

function BottomTabBar({ pathname }: { pathname: string | null }) {
  const me = useHydratedSession();
  const tabs = [
    { href: "/", label: "Accueil", icon: IconHome, active: isActive(pathname, "/") },
    { href: "/salon", label: "Jeux", icon: IconGamepad, active: isActive(pathname, "/salon") || isActive(pathname, "/jeu") },
    {
      href: "/paris",
      label: "Paris",
      icon: IconBall,
      active: isActive(pathname, "/paris") && !isActive(pathname, "/paris/mes-paris"),
      featured: true,
    },
    { href: "/paris/mes-paris", label: "Mes paris", icon: IconTicket, active: isActive(pathname, "/paris/mes-paris") },
    me
      ? {
          href: "/portefeuille",
          label: "Portefeuille",
          icon: IconWallet,
          active: ["/portefeuille", "/tableau-de-bord", "/pro"].some((h) => isActive(pathname, h)),
        }
      : { href: "/connexion", label: "Compte", icon: IconUser, active: isActive(pathname, "/connexion") || isActive(pathname, "/inscription") },
  ];

  return (
    <nav aria-label="Navigation mobile" className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line xl:hidden">
      <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-lg grid-cols-5">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cx(
                "group relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition",
                t.active ? "text-white" : "text-slate-400 active:text-slate-200",
              )}
            >
              {t.active && <span className="bg-brand-gradient absolute top-0 h-[3px] w-8 rounded-b-full" />}
              <span
                className={cx(
                  "flex h-8 w-12 items-center justify-center rounded-full transition",
                  t.active && (t.featured ? "bg-brand-gradient text-slate-950 shadow-glow-sm" : "bg-white/10 text-amber-300"),
                )}
              >
                <t.icon className="h-[22px] w-[22px]" />
              </span>
              <span className="max-w-full truncate px-0.5">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
