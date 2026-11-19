import { describe, expect, it } from "vitest";
import { authBaseURL, authSecret, missingSecretOnVercel } from "@/lib/auth/config";

const SITE = "https://dn-pede-ai.vercel.app";

describe("authBaseURL", () => {
  it("usa o endereço publicado na Vercel", () => {
    expect(authBaseURL({ VERCEL: "1" }, SITE)).toBe(SITE);
    expect(authBaseURL({ VERCEL: "1", BETTER_AUTH_URL: "https://outro.dev" }, SITE)).toBe("https://outro.dev");
  });

  it("aceita só hosts locais no computador", () => {
    expect(authBaseURL({}, SITE)).toEqual({
      allowedHosts: ["localhost:*", "127.0.0.1:*"],
      protocol: "http",
      fallback: "http://localhost:3000",
    });
  });
});

describe("authSecret", () => {
  it("prefere BETTER_AUTH_SECRET e cai para SESSION_SECRET", () => {
    expect(authSecret({ BETTER_AUTH_SECRET: "a", SESSION_SECRET: "b" })).toBe("a");
    expect(authSecret({ SESSION_SECRET: "b" })).toBe("b");
  });

  it("gera uma chave estável no processo sem nenhuma variável", () => {
    const first = authSecret({});
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(authSecret({})).toBe(first);
  });
});

describe("missingSecretOnVercel", () => {
  it("avisa só na Vercel sem chave fixa", () => {
    expect(missingSecretOnVercel({ VERCEL: "1" })).toBe(true);
    expect(missingSecretOnVercel({ VERCEL: "1", SESSION_SECRET: "x" })).toBe(false);
    expect(missingSecretOnVercel({})).toBe(false);
  });
});
