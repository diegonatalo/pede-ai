import { describe, expect, it } from "vitest";
import type { RateLimiter } from "@/lib/rate-limit";

/** Contrato do limitador (memória e Postgres): 3 falhas em 1 minuto. */
export const describeRateLimiterContract = (makeLimiter: (config: { failures: number; windowMs: number }) => RateLimiter) => {
  const MINUTE = 60_000;
  const T0 = Date.parse("2026-11-20T12:00:00.000Z");

  describe("limitador de tentativas", () => {
    it("bloqueia ao chegar no limite e libera quando a janela passa", async () => {
      const limiter = makeLimiter({ failures: 3, windowMs: MINUTE });
      expect(await limiter.isBlocked("join:a", T0)).toBe(false);
      for (const offset of [0, 1000, 2000]) await limiter.recordFailure("join:a", T0 + offset);
      expect(await limiter.isBlocked("join:a", T0 + 3000)).toBe(true);
      // Outra chave não é afetada.
      expect(await limiter.isBlocked("join:b", T0 + 3000)).toBe(false);
      // A janela conta do primeiro erro: passou um minuto, libera.
      expect(await limiter.isBlocked("join:a", T0 + MINUTE)).toBe(false);
      // Erro depois da janela começa a contar de novo.
      await limiter.recordFailure("join:a", T0 + MINUTE + 1);
      expect(await limiter.isBlocked("join:a", T0 + MINUTE + 2)).toBe(false);
    });

    it("conta falhas ao mesmo tempo sem perder nenhuma", async () => {
      const limiter = makeLimiter({ failures: 5, windowMs: MINUTE });
      await Promise.all(Array.from({ length: 5 }, () => limiter.recordFailure("join:c", T0)));
      expect(await limiter.isBlocked("join:c", T0 + 1)).toBe(true);
    });

    it("apaga contagens antigas", async () => {
      const limiter = makeLimiter({ failures: 3, windowMs: MINUTE });
      await limiter.recordFailure("join:velha", T0);
      await limiter.recordFailure("join:nova", T0 + 10 * MINUTE);
      expect(await limiter.prune(T0 + MINUTE)).toBe(1);
      expect(await limiter.prune(T0 + MINUTE)).toBe(0);
    });
  });
};
