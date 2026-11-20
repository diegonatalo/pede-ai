// @vitest-environment node
import { createECDH, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { generateRequestDetails, generateVAPIDKeys } from "web-push";
import { pushOptions, sendToStaff, vapidConfig } from "@/lib/push-send";
import { createMemoryPushStore, createMemoryStore } from "@/lib/store/memory";

const config = { publicKey: "pub", privateKey: "priv", subject: "https://exemplo.com" };
const message = { title: "Pronto para levar", body: "2× Chope · Mesa 3", tag: "pronto-i1", url: "/r/demo/garcom" };
const sub = (endpoint: string, staffId: string) => ({
  endpoint,
  restaurantId: "demo",
  staffId,
  p256dh: "chave",
  auth: "segredo",
  createdAt: "2026-11-20T20:00:00.000Z",
});

describe("vapidConfig", () => {
  it("liga só com as duas chaves", () => {
    expect(vapidConfig({})).toBeNull();
    expect(vapidConfig({ VAPID_PUBLIC_KEY: "a" })).toBeNull();
    expect(vapidConfig({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "mailto:x@y.z" })).toEqual({
      publicKey: "a",
      privateKey: "b",
      subject: "mailto:x@y.z",
    });
  });
});

describe("sendToStaff", () => {
  it("manda para a equipe ativa e limpa quem saiu e aparelho que não existe mais", async () => {
    const store = createMemoryStore();
    const pushStore = createMemoryPushStore();
    const manager = { role: "manager" as const, staffId: "staff-demo-manager" };
    const created = await store.createStaff({ name: "Bruno", role: "waiter" }, manager);
    if (!created.ok) throw new Error(created.error);
    await store.setStaffActive(created.value.member.id, false, manager);

    await pushStore.save(sub("https://push.example/ok", "staff-demo-waiter"));
    await pushStore.save(sub("https://push.example/sumiu", "staff-demo-manager"));
    await pushStore.save(sub("https://push.example/desativado", created.value.member.id));
    await pushStore.save(sub("https://push.example/erro", "staff-demo-waiter"));

    const send = vi.fn(async (subscription: { endpoint: string }, payload: unknown, options: unknown) => {
      if (subscription.endpoint.endsWith("sumiu")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (subscription.endpoint.endsWith("erro")) throw Object.assign(new Error("falha"), { statusCode: 500 });
      expect(JSON.parse(String(payload))).toEqual(message);
      expect(options).toMatchObject({ TTL: 300, urgency: "high", vapidDetails: { publicKey: "pub" } });
      return { statusCode: 201, body: "", headers: {} };
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const delivered = await sendToStaff({ restaurantId: "demo", store, pushStore, message, config, send: send as never });
    expect(delivered).toBe(1);
    expect(send).toHaveBeenCalledTimes(3);
    // Quem foi desativado e o aparelho que sumiu (410) saem; erro passageiro (500) fica para a próxima.
    expect((await pushStore.listForRestaurant("demo")).map((entry) => entry.endpoint).sort()).toEqual([
      "https://push.example/erro",
      "https://push.example/ok",
    ]);
    error.mockRestore();
  });
});

describe("aviso de verdade (sem rede)", () => {
  it("sai criptografado e assinado com as chaves VAPID, como os navegadores exigem", () => {
    const keys = generateVAPIDKeys();
    const real = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: "https://dn-pede-ai.vercel.app" };
    // Chaves de um "navegador" de mentira: as mesmas curvas que o Chrome e o Safari usam.
    const browser = createECDH("prime256v1");
    browser.generateKeys();
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/aparelho-de-teste",
      keys: { p256dh: browser.getPublicKey("base64url"), auth: randomBytes(16).toString("base64url") },
    };
    const details = generateRequestDetails(subscription, JSON.stringify(message), pushOptions(real, message));
    expect(details.method).toBe("POST");
    expect(details.endpoint).toBe(subscription.endpoint);
    expect(details.headers).toMatchObject({ "Content-Encoding": "aes128gcm", TTL: 300, Urgency: "high", Topic: "pronto-i1" });
    expect(String(details.headers.Authorization)).toMatch(new RegExp(`^vapid t=[^,]+, k=${keys.publicKey}$`));
    // O corpo é o aviso criptografado: não dá para ler o texto sem a chave do aparelho.
    expect(Buffer.isBuffer(details.body)).toBe(true);
    expect(String(details.body)).not.toContain("Chope");
  });
});
