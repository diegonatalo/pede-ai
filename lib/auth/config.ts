import { readSessionSecret } from "@/lib/api/config";

type Env = Record<string, string | undefined>;

/** Hosts locais aceitos fora da Vercel (`pnpm dev`, `pnpm start` do E2E), em qualquer porta. */
const LOCAL_HOSTS = ["localhost:*", "127.0.0.1:*"];

/**
 * Endereço base do login. Na Vercel, o endereço publicado; no computador, o host da própria
 * requisição, desde que seja local (o Better Auth recusa hosts fora da lista).
 */
export const authBaseURL = (env: Env, siteUrl: string) =>
  env.VERCEL
    ? (env.BETTER_AUTH_URL ?? siteUrl)
    : { allowedHosts: LOCAL_HOSTS, protocol: "http" as const, fallback: "http://localhost:3000" };

/**
 * Chave do login: `BETTER_AUTH_SECRET`, senão a mesma `SESSION_SECRET` dos cookies do app,
 * para não exigir mais uma variável. Sem nenhuma das duas, uma chave aleatória por processo
 * (só serve num processo só, como no computador).
 */
export const authSecret = (env: Env) => env.BETTER_AUTH_SECRET || readSessionSecret(env);

/** Na Vercel sem chave fixa, cada instância teria a própria chave e as sessões cairiam. */
export const missingSecretOnVercel = (env: Env) =>
  Boolean(env.VERCEL) && !env.BETTER_AUTH_SECRET && !env.SESSION_SECRET;
