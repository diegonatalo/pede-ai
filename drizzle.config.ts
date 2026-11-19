import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// O drizzle-kit roda fora do Next: lê o .env.local por conta própria (Node 20.12+).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Migrações usam a conexão direta (sem pooler), como o Neon recomenda.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dbCredentials: { url: url ?? "" },
  strict: true,
});
