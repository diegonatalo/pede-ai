import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { memoryAdapter } from "better-auth/adapters/memory";
import { drizzle } from "drizzle-orm/neon-http";
import { authBaseURL, authSecret, missingSecretOnVercel } from "@/lib/auth/config";
import { authAccounts, authSessions, authUsers, authVerifications } from "@/lib/db/schema";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { storeKind } from "@/lib/store";

type Env = Record<string, string | undefined>;

/** Banco do login: o Postgres quando o app usa o Postgres; memória no resto (CI, E2E, `pnpm dev`). */
const database = (env: Env) => {
  if (storeKind(env) === "postgres") {
    const db = drizzle(env.DATABASE_URL as string);
    return drizzleAdapter(db, {
      provider: "pg",
      schema: { user: authUsers, session: authSessions, account: authAccounts, verification: authVerifications },
    });
  }
  // Mesmo motivo do store: o globalThis sobrevive ao recarregamento e às cópias do módulo por rota.
  const holder = globalThis as typeof globalThis & { __pedeAiAuthMemory?: Record<string, unknown[]> };
  holder.__pedeAiAuthMemory ??= { user: [], session: [], account: [], verification: [] };
  return memoryAdapter(holder.__pedeAiAuthMemory as Record<string, never[]>);
};

/** Login das contas dos donos de restaurante: e-mail e senha, sem serviço externo. */
export const createAuth = (env: Env = process.env) => {
  if (missingSecretOnVercel(env)) {
    console.warn("pede-ai: defina SESSION_SECRET (ou BETTER_AUTH_SECRET) na Vercel; sem ela, as sessões caem entre instâncias.");
  }
  return betterAuth({
    appName: SITE_NAME,
    baseURL: authBaseURL(env, SITE_URL),
    secret: authSecret(env),
    database: database(env),
    // Limite de tentativas só na Vercel. No `next start` local (E2E), todos os testes vêm do mesmo
    // endereço e criariam contas mais rápido que o limite de cadastro (3 a cada 10 s).
    rateLimit: { enabled: Boolean(env.VERCEL) },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Sem serviço de e-mail ainda: não há confirmação nem redefinição por link (ver o plano da fase 2).
      requireEmailVerification: false,
      autoSignIn: true,
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;

const holder = globalThis as typeof globalThis & { __pedeAiAuth?: Auth };

export const getAuth = (): Auth => {
  holder.__pedeAiAuth ??= createAuth();
  return holder.__pedeAiAuth;
};
