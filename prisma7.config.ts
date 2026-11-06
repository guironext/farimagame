import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local" });

// La génération du client ne se connecte pas. Sans variable (build Vercel),
// une adresse locale suffit pour que `prisma generate` produise les fichiers.
const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? "postgresql://127.0.0.1:5432/farimagame";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
