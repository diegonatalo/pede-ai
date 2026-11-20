import { describe, expect, it } from "vitest";
import type { PushStore } from "@/lib/push";

const record = (endpoint: string, restaurantId: string, staffId = "s1") => ({
  endpoint,
  restaurantId,
  staffId,
  p256dh: "chave",
  auth: "segredo",
  createdAt: "2026-11-20T20:00:00.000Z",
});

/** Contrato das inscrições de push (memória e Postgres). Os restaurantes "demo" e "rest-b" precisam existir. */
export const describePushStoreContract = (makeStore: () => PushStore) => {
  describe("inscrições de push", () => {
    it("guarda por restaurante, troca a do mesmo aparelho e apaga", async () => {
      const store = makeStore();
      await store.save(record("https://push.example/1", "demo"));
      await store.save(record("https://push.example/2", "rest-b"));
      // O mesmo aparelho com outra pessoa: troca, não duplica.
      await store.save(record("https://push.example/1", "demo", "s2"));
      expect((await store.listForRestaurant("demo")).map((entry) => [entry.endpoint, entry.staffId])).toEqual([
        ["https://push.example/1", "s2"],
      ]);
      expect((await store.listForRestaurant("rest-b")).map((entry) => entry.endpoint)).toEqual(["https://push.example/2"]);
      await store.remove("https://push.example/1");
      expect(await store.listForRestaurant("demo")).toEqual([]);
    });
  });
};
