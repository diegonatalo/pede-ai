import { describe, expect, it } from "vitest";
import { getPushConfig, subscribePush, unsubscribePush } from "@/lib/api/push";
import type { ApiResult } from "@/lib/api/result";
import { createMemoryPushStore } from "@/lib/store/memory";

const errorOf = (result: ApiResult) => (result.body as { error?: string }).error ?? "ok";
const waiter = { role: "waiter" as const, staffId: "w1", name: "Bruno" };
const kitchen = { role: "kitchen" as const, staffId: "k1", name: "Caio" };
const subscription = { endpoint: "https://push.example/1", keys: { p256dh: "chave", auth: "segredo" } };
const NOW = "2026-11-20T20:00:00.000Z";

describe("avisos da equipe", () => {
  it("dá a chave pública para o garçom e o gerente, não para a cozinha", () => {
    expect(getPushConfig(waiter, "pub").body).toEqual({ publicKey: "pub" });
    expect(getPushConfig({ ...waiter, role: "manager" }, null).body).toEqual({ publicKey: null });
    expect(errorOf(getPushConfig(kitchen, "pub"))).toBe("forbidden");
  });

  it("inscreve o aparelho em nome de quem entrou, e desinscreve", async () => {
    const pushStore = createMemoryPushStore();
    expect(errorOf(await subscribePush(pushStore, waiter, "demo", { subscription }, NOW, true))).toBe("ok");
    expect(await pushStore.listForRestaurant("demo")).toEqual([
      { endpoint: subscription.endpoint, p256dh: "chave", auth: "segredo", restaurantId: "demo", staffId: "w1", createdAt: NOW },
    ]);
    expect(errorOf(await unsubscribePush(pushStore, waiter, { endpoint: subscription.endpoint }))).toBe("ok");
    expect(await pushStore.listForRestaurant("demo")).toEqual([]);
  });

  it("recusa a cozinha, inscrição inválida e servidor sem chaves", async () => {
    const pushStore = createMemoryPushStore();
    expect(errorOf(await subscribePush(pushStore, kitchen, "demo", { subscription }, NOW, true))).toBe("forbidden");
    expect(errorOf(await subscribePush(pushStore, waiter, "demo", { subscription: { endpoint: "x" } }, NOW, true))).toBe(
      "invalid_input",
    );
    expect(errorOf(await subscribePush(pushStore, waiter, "demo", { subscription }, NOW, false))).toBe("invalid_input");
    expect(errorOf(await unsubscribePush(pushStore, waiter, {}))).toBe("invalid_input");
  });
});
