// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "@/lib/store/memory";

// Fora do Next, o `server-only` sempre lança: aqui ele não faz nada, como no servidor.
vi.mock("server-only", () => ({}));

const after = vi.hoisted(() => vi.fn());
const sendToStaff = vi.hoisted(() => vi.fn(async () => 1));
vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/push-send", async (original) => ({ ...(await original<object>()), sendToStaff }));

const { notifyStaff } = await import("@/lib/api/notify");

const message = { title: "Pronto para levar", body: "1× Chope · Mesa 1", tag: "pronto-1", url: "/r/demo/garcom" };

describe("notifyStaff", () => {
  beforeEach(() => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("agenda o envio para depois da resposta, com a mensagem montada pelo endereço do restaurante", async () => {
    const store = createMemoryStore();
    const build = vi.fn(async (slug: string) => ({ ...message, url: `/r/${slug}/garcom` }));
    notifyStaff(store, build);
    expect(sendToStaff).not.toHaveBeenCalled();
    await after.mock.calls[0][0]();
    expect(build).toHaveBeenCalledWith("demo");
    expect(sendToStaff).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "demo", message, config: expect.objectContaining({ publicKey: "pub" }) }),
    );
  });

  it("não envia quando a mensagem não sai, e nem agenda sem as chaves", async () => {
    const store = createMemoryStore();
    notifyStaff(store, async () => null);
    await after.mock.calls[0][0]();
    expect(sendToStaff).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    after.mockClear();
    notifyStaff(store, async () => message);
    expect(after).not.toHaveBeenCalled();
  });

  it("um erro no envio não derruba nada (só vai para o log)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    sendToStaff.mockRejectedValueOnce(new Error("fora do ar"));
    notifyStaff(createMemoryStore(), async () => message);
    await expect(after.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
