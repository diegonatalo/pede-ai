// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CountAttempt } from "@/lib/rate-limit";

const countAttempt = vi.hoisted(() => vi.fn<CountAttempt>());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/store/postgres", async (original) => ({
  ...(await original<object>()),
  createPostgresAttemptCounter: () => countAttempt,
}));

import { createAuthRateLimit } from "@/lib/auth/rate-limit";
import { createAuth } from "@/lib/auth/server";

const SECRET = "segredo-de-teste-com-tamanho-suficiente";
const NOW = 1_000_000;
const RULE = { window: 10, max: 3 };
const KEY = "203.0.113.7|/sign-in/email";

beforeEach(() => {
  countAttempt.mockReset();
});

describe("createAuthRateLimit", () => {
  const storage = createAuthRateLimit(countAttempt, SECRET, () => NOW);

  it("deixa passar até o limite", async () => {
    countAttempt.mockResolvedValue({ count: 3, windowStart: NOW - 4000 });
    expect(await storage.consume(KEY, RULE)).toEqual({ allowed: true, retryAfter: null });
  });

  it("bloqueia depois do limite e diz quanto falta", async () => {
    countAttempt.mockResolvedValue({ count: 4, windowStart: NOW - 4000 });
    expect(await storage.consume(KEY, RULE)).toEqual({ allowed: false, retryAfter: 6 });
  });

  it("nunca manda esperar zero segundo", async () => {
    countAttempt.mockResolvedValue({ count: 4, windowStart: NOW - 10_000 });
    expect(await storage.consume(KEY, RULE)).toEqual({ allowed: false, retryAfter: 1 });
  });

  it("não guarda o IP nem a rota, e separa um IP do outro", async () => {
    countAttempt.mockResolvedValue({ count: 1, windowStart: NOW });
    await storage.consume(KEY, RULE);
    await storage.consume("203.0.113.8|/sign-in/email", RULE);
    const [first, second] = countAttempt.mock.calls.map(([attempt]) => attempt.key);
    expect(first).toMatch(/^auth:[\w-]{32}$/);
    expect(first).not.toContain("203.0.113");
    expect(second).not.toBe(first);
  });
});

describe("login na Vercel com Postgres", () => {
  it("pergunta ao banco e responde 429 quando ele diz que passou", async () => {
    countAttempt.mockResolvedValue({ count: 4, windowStart: Date.now() });
    const origin = "https://pede-ai.test";
    const auth = createAuth({ VERCEL: "1", DATABASE_URL: "postgres://localhost/app", BETTER_AUTH_URL: origin, SESSION_SECRET: SECRET });

    const response = await auth.handler(
      new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin, "x-forwarded-for": "203.0.113.7" },
        body: JSON.stringify({ email: "dono@exemplo.test", password: "senha-forte-1" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(countAttempt).toHaveBeenCalledOnce();
    expect(countAttempt.mock.calls[0][0]).toMatchObject({ windowMs: 10_000, max: 3 });
  });
});
