import { describe, expect, it } from "vitest";
import { getStore } from "@/lib/store";
import type { Store } from "@/types/store";

const holder = globalThis as typeof globalThis & { __pedeAiStore?: Store };

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
