import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, withRestaurant } from "@/lib/api-client";

const mockFetch = (implementation: () => Promise<Response>) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(implementation);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiRequest", () => {
  it("devolve os dados quando dá certo", async () => {
    mockFetch(async () => Response.json({ a: 1 }));
    expect(await apiRequest("/api/menu")).toEqual({ ok: true, data: { a: 1 } });
  });

  it("manda JSON nos comandos", async () => {
    const spy = mockFetch(async () => Response.json({}));
    await apiRequest("/api/customer/orders", { method: "POST", body: { tabId: "t1" } });
    const [, init] = spy.mock.calls[0];
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tabId: "t1" }),
    });
  });

  it("repassa o código e a mensagem do servidor", async () => {
    mockFetch(async () => Response.json({ error: "wrong_code", message: "Código errado." }, { status: 401 }));
    expect(await apiRequest("/api/tables/mesa-1/join", { method: "POST" })).toEqual({
      ok: false,
      status: 401,
      error: "wrong_code",
      message: "Código errado.",
    });
  });

  it("usa mensagem genérica quando o erro não tem JSON", async () => {
    mockFetch(async () => new Response("erro", { status: 500 }));
    expect(await apiRequest("/api/customer")).toMatchObject({ ok: false, status: 500, error: "unknown" });
  });

  it("avisa quando está sem conexão", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await apiRequest("/api/customer")).toMatchObject({ ok: false, status: 0, error: "network" });
  });
});

describe("withRestaurant", () => {
  it("deixa a demonstração sem parâmetro", () => {
    expect(withRestaurant("/api/menu", "demo")).toBe("/api/menu");
  });

  it("leva o restaurante em ?r=, junto dos outros parâmetros", () => {
    expect(withRestaurant("/api/menu", "cantina")).toBe("/api/menu?r=cantina");
    expect(withRestaurant("/api/staff/feed?role=waiter", "bar do zé")).toBe(
      "/api/staff/feed?role=waiter&r=bar%20do%20z%C3%A9",
    );
  });
});
