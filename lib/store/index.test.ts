import { describe, expect, it } from "vitest";
import { getStore, storeKind } from "@/lib/store";
import type { Store } from "@/types/store";

const holder = globalThis as typeof globalThis & { __pedeAiStore?: Store };

describe("storeKind", () => {
  const url = "postgres://exemplo";

  it("usa o Postgres na Vercel com DATABASE_URL", () => {
    expect(storeKind({ DATABASE_URL: url, VERCEL: "1" })).toBe("postgres");
  });

  it("usa memória no computador, mesmo com DATABASE_URL no .env.local", () => {
    expect(storeKind({ DATABASE_URL: url })).toBe("memory");
    expect(storeKind({})).toBe("memory");
    expect(storeKind({ VERCEL: "1" })).toBe("memory");
  });

  it("usa o Postgres no computador só quando pedido", () => {
    expect(storeKind({ DATABASE_URL: url, PEDE_AI_STORE: "postgres" })).toBe("postgres");
  });
});

describe("getStore", () => {
  it("devolve sempre o mesmo store no processo", () => {
    expect(getStore()).toBe(getStore());
  });

  it("troca um store antigo, sem os métodos atuais, por um novo (next dev)", () => {
    const old: Partial<Store> = { ...getStore() };
    delete old.listSessionsSince;
    holder.__pedeAiStore = old as Store;
    const after = getStore();
    expect(after).not.toBe(old);
    expect(typeof after.listSessionsSince).toBe("function");
    expect(getStore()).toBe(after);
  });
});
