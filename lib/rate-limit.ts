import { createHmac } from "node:crypto";

/**
 * Códigos de mesa errados por endereço de internet, somando todas as mesas e restaurantes.
 * O limite por mesa (5 erros) não segura quem tenta mesa por mesa; este segura.
 */
export const JOIN_LIMIT = { failures: 15, windowMs: 10 * 60_000 } as const;

/** Contagem de falhas numa janela de tempo, guardada por chave. */
export type RateLimiter = {
  /** Já passou do limite na janela atual? */
  isBlocked(key: string, nowMs: number): Promise<boolean>;
  /** Soma uma falha (começa uma janela nova se a anterior acabou). */
  recordFailure(key: string, nowMs: number): Promise<void>;
  /** Apaga contagens de janelas que começaram antes de `beforeMs`. Devolve quantas. */
  prune(beforeMs: number): Promise<number>;
};

export type RateLimitConfig = { failures: number; windowMs: number };

/** Uma janela ainda vale se começou há menos de `windowMs`. */
export const windowActive = (windowStart: number, nowMs: number, windowMs: number) => windowStart > nowMs - windowMs;

/**
 * Endereço de quem fez a requisição. Na Vercel, o primeiro do `x-forwarded-for` é o do aparelho
 * (a própria Vercel preenche o cabeçalho). Sem ele (computador local), todos dividem a mesma chave.
 */
export const clientIp = (headers: Headers) =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "local";

/**
 * Chave guardada no banco: um HMAC do endereço com a chave do app, nunca o endereço em si
 * (endereço de internet é dado pessoal).
 */
export const rateKey = (scope: string, ip: string, secret: string) =>
  `${scope}:${createHmac("sha256", secret).update(ip).digest("base64url").slice(0, 32)}`;
