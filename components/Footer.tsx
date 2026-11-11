import Link from "next/link";

export function Footer() {
  return (
    <footer className="pb-tabbar mt-10 border-t border-line bg-black/20 xl:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="text-lg font-extrabold tracking-tight">
            Farima<span className="text-brand">Game</span>
          </div>
          <p className="mt-2 max-w-xs text-sm text-slate-400">
            Jeux de société africains et classiques. Le gagnant empoche 80 % des mises.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FooterCol
            title="Jouer"
            links={[
              ["/salon?jeu=ludo", "Ludo"],
              ["/salon?jeu=dames", "Dames"],
              ["/salon?jeu=awale", "Awalé"],
              ["/salon?jeu=echecs", "Échecs"],
            ]}
          />
          <FooterCol
            title="Compte"
            links={[
              ["/tableau-de-bord", "Tableau de bord"],
              ["/portefeuille", "Portefeuille"],
              ["/passer-pro", "Passez Pro"],
              ["/inscription", "Inscription"],
            ]}
          />
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-center text-xs text-slate-500 sm:flex-row sm:text-left">
          <span>© FarimaGame · Jeux 80/20</span>
          <span className="flex items-center gap-2">
            <span className="rounded-md border border-rose-400/40 px-1.5 py-0.5 font-bold text-rose-300">18+</span>
            Jouez de façon responsable.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <ul className="mt-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="inline-flex min-h-10 items-center text-[13px] text-slate-300 hover:text-white sm:text-sm">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
