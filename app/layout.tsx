import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppSkeleton } from "@/components/AppSkeleton";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { SessionProvider } from "@/components/SessionProvider";
import { AFTER_SIGN_IN_URL, AFTER_SIGN_UP_URL, CLERK_ENABLED, SIGN_IN_URL, SIGN_UP_URL } from "@/lib/clerk";
import { clerkAppearance, clerkLocalization } from "@/lib/clerk-appearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FarimaGame – Ludo, Dames, Awalé, Échecs & paris sportifs",
  description: "Plateforme de jeux : Ludo, Jeu de Dames, Awalé et Échecs. Jouez en Coris, passez Pro, jouez en Lions et pariez sur le football en F CFA.",
};

export const viewport: Viewport = {
  themeColor: "#050b1a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {CLERK_ENABLED ? (
          // Avec cacheComponents, ClerkProvider doit être placé DANS <body>, sous <Suspense>, et rendu à la requête.
          <Suspense fallback={<AppSkeleton />}>
            <ClerkRoot>
              <AppShell>{children}</AppShell>
            </ClerkRoot>
          </Suspense>
        ) : (
          <AppShell>{children}</AppShell>
        )}
      </body>
    </html>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-8">{children}</main>
      <Footer />
    </SessionProvider>
  );
}

/** ClerkProvider rendu à chaque requête (session + mode keyless en développement). */
async function ClerkRoot({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      localization={clerkLocalization}
      signInUrl={SIGN_IN_URL}
      signUpUrl={SIGN_UP_URL}
      signInFallbackRedirectUrl={AFTER_SIGN_IN_URL}
      signUpFallbackRedirectUrl={AFTER_SIGN_UP_URL}
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
