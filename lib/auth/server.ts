import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { memoryAdapter } from "better-auth/adapters/memory";
import { deleteOwnedRestaurants } from "@/lib/api/account";
import { authBaseURL, authSecret, missingSecretOnVercel } from "@/lib/auth/config";
import { createAuthRateLimit } from "@/lib/auth/rate-limit";
import { getDb } from "@/lib/db";
import { authAccounts, authSessions, authUsers, authVerifications } from "@/lib/db/schema";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getRegistry, storeKind } from "@/lib/store";
import { createPostgresAttemptCounter } from "@/lib/store/postgres";
import { termsAcceptance } from "@/lib/terms";

type Env = Record<string, string | undefined>;

const termsNotAccepted = () =>
  new APIError("BAD_REQUEST", { code: "TERMS_NOT_ACCEPTED", message: "Aceite a versão atual dos termos de uso." });

/** Banco do login: o Postgres quando o app usa o Postgres; memória no resto (CI, E2E, `pnpm dev`). */
const database = (env: Env) => {
  if (storeKind(env) === "postgres") {
    return drizzleAdapter(getDb(), {
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
    // Limite de tentativas só na Vercel, contado no Postgres quando o app o usa. No `next start`
    // local (E2E), todos os testes vêm do mesmo endereço e criariam contas mais rápido que o
    // limite de cadastro (3 a cada 10 s).
    rateLimit: {
      enabled: Boolean(env.VERCEL),
      ...(storeKind(env) === "postgres" && {
        customStorage: createAuthRateLimit(createPostgresAttemptCounter(getDb()), authSecret(env)),
      }),
    },
    user: {
      // Aceite dos termos: o navegador manda a versão; a data é sempre a do servidor.
      additionalFields: {
        termsVersion: { type: "string", required: false, input: true },
        termsAcceptedAt: { type: "date", required: false, input: false },
      },
      // A pessoa apaga a própria conta confirmando a senha; os restaurantes dela vão junto (LGPD).
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          await deleteOwnedRestaurants(getRegistry(), user.id);
        },
      },
    },
    databaseHooks: {
      user: {
        // Sem aceitar a versão atual dos termos, a conta não é criada.
        create: {
          before: async (user) => {
            const accepted = termsAcceptance(user.termsVersion, new Date());
            if (!accepted) throw termsNotAccepted();
            return { data: { ...user, ...accepted } };
          },
        },
        // Quem já tem conta aceita a versão nova pela tela da conta (`updateUser`).
        update: {
          before: async (data) => {
            if (data.termsVersion === undefined) return;
            const accepted = termsAcceptance(data.termsVersion, new Date());
            if (!accepted) throw termsNotAccepted();
            return { data: { ...data, ...accepted } };
          },
        },
      },
    },
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
