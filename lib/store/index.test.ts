import { describe, expect, it } from "vitest";
import { getStore, storeKind } from "@/lib/store";
import type { Store } from "@/types/store";

const holder = globalThis as typeof globalThis & { __pedeAiStores?: Map<string, Store> };

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
  it("devolve sempre o mesmo store para o mesmo restaurante", () => {
    expect(getStore("demo")).toBe(getStore("demo"));
  });

  it("troca o mundo em memória quando o motor ganhou métodos novos (next dev)", () => {
    const old: Partial<Store> = { ...getStore("demo") };
    delete old.listSessionsSince;
    holder.__pedeAiStores = new Map([["demo", old as Store]]);
    const after = getStore("demo");
    expect(after).not.toBe(old);
    expect(typeof after.listSessionsSince).toBe("function");
    expect(getStore("demo")).toBe(after);
  });
});
