import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-neon"],
  // Dossier de compilation séparé pour un serveur de test (FARIMA_NEXT_DIST_DIR=.next-test),
  // afin qu'il tourne à côté de `npm run dev` sans le perturber.
  distDir: process.env.FARIMA_NEXT_DIST_DIR || ".next",
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
    // Sans clés Clerk (mode keyless de développement), le fournisseur Clerk charge un composant de façon dynamique
    // que la validation « instant » de `next dev` ne sait pas encore instancier : on limite alors cette validation
    // (avertissements de développement uniquement) aux segments qui la demandent explicitement.
    instantInsights: {
      validationLevel: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "warning" : "manual-warning",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
