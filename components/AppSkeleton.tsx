// Squelette affiché le temps que la session Clerk soit lue (quelques millisecondes, rendu côté serveur).
import Image from "next/image";

export function AppSkeleton() {
  return (
    <>
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-[var(--header-h)] max-w-6xl items-center justify-between gap-3 px-4 xl:h-16">
          <span className="flex shrink-0 items-center gap-2">
            <Image src="/logo.png" alt="" width={40} height={40} className="h-9 w-9 rounded-xl ring-1 ring-white/10 xl:h-10 xl:w-10" priority />
            <span className="text-base font-extrabold tracking-tight max-[379px]:hidden sm:text-lg">
              Farima<span className="text-brand">Game</span>
            </span>
          </span>
          <div className="skeleton h-10 w-28 rounded-full" aria-hidden />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-8" aria-busy="true">
        <div className="skeleton h-48 w-full rounded-2xl" aria-hidden />
      </main>
    </>
  );
}
