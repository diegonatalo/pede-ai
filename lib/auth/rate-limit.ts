import type { BetterAuthOptions } from "better-auth";
import { rateKey, type CountAttempt } from "@/lib/rate-limit";

type Storage = NonNullable<NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]>;

/**
 * Limite do login no banco, para valer em todas as instâncias da Vercel: na memória,
 * cada instância conta separado. Usa a tabela das outras contagens, com a mesma limpeza
 * diária. A chave do Better Auth tem o IP (`ip|rota`), então vai para o banco como HMAC.
 */
export const createAuthRateLimit = (countAttempt: CountAttempt, secret: string, now = () => Date.now()): Storage => ({
  async consume(key, rule) {
    const nowMs = now();
    const windowMs = rule.window * 1000;
    const { count, windowStart } = await countAttempt({
      key: rateKey("auth", key, secret),
      nowMs,
      windowMs,
      max: rule.max,
    });
    if (count <= rule.max) return { allowed: true, retryAfter: null };
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000)) };
  },
});
