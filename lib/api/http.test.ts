// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { CUSTOMER_COOKIE, STAFF_COOKIE, handleCustomer, handleStaff, respond } from "@/lib/api/http";
import type { StaffIdentity } from "@/lib/api/identity";
import { error, success } from "@/lib/api/result";
import { newRestaurantData, sampleRestaurantData } from "@/lib/restaurant-template";
import { getRegistry, getStore } from "@/lib/store";

// Restaurante de exemplo, criado no mundo em memória do processo antes dos testes.
const URL_BASE = "http://localhost/api/teste?r=demo";

beforeAll(async () => {
  await getRegistry().create(sampleRestaurantData());
});

const post = (body: string, headers: Record<string, string> = { "content-type": "application/json" }) =>
  new NextRequest(URL_BASE, { method: "POST", body, headers });

/** Copia o cookie gravado numa resposta para uma requisição nova, como o navegador faria. */
const cookieFrom = (response: Response, name: string) => {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : "";
};

describe("respond", () => {
  it("devolve JSON com o status e sem cache", async () => {
    const response = await respond(error("forbidden"));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: "forbidden" });
  });

  it("grava o cookie httpOnly e o apaga com null", async () => {
    const saved = await respond(success({}, { customer: { sessionId: "s1", tabIds: [], exp: Date.now() + 60_000 } }));
    const header = saved.headers.get("set-cookie") ?? "";
    expect(header).toContain(`${CUSTOMER_COOKIE}=`);
    expect(header.toLowerCase()).toContain("httponly");
    expect(header.toLowerCase()).toContain("samesite=lax");

    const removed = await respond(success({}, { customer: null }));
    expect(removed.headers.get("set-cookie")).toMatch(new RegExp(`${CUSTOMER_COOKIE}=;`));
  });
});

describe("handleCustomer", () => {
  it("recusa corpo que não é JSON", async () => {
    const response = await handleCustomer(post("code=1234", { "content-type": "application/x-www-form-urlencoded" }), () =>
      success({}),
    );
    expect(response.status).toBe(415);
  });

  it("recusa JSON quebrado e aceita corpo vazio", async () => {
    expect((await handleCustomer(post("{"), () => success({}))).status).toBe(400);
    const response = await handleCustomer(post(""), (_identity, body) => success({ body }));
    expect(await response.json()).toEqual({ body: {} });
  });

  it("lê de volta a identidade gravada no cookie", async () => {
    const identity = { sessionId: "s1", tabIds: ["t1"], exp: Date.now() + 60_000 };
    const saved = await respond(success({}, { customer: identity }));
    const request = new NextRequest(URL_BASE, { headers: { cookie: cookieFrom(saved, CUSTOMER_COOKIE) } });
    const response = await handleCustomer(request, (read) => success(read));
    expect(await response.json()).toEqual(identity);
  });

  it("ignora cookie adulterado", async () => {
    const request = new NextRequest(URL_BASE, { headers: { cookie: `${CUSTOMER_COOKIE}=eyJ4IjoxfQ.assinatura` } });
    const response = await handleCustomer(request, (read) => success({ read }));
    expect(await response.json()).toEqual({ read: null });
  });
});

describe("handleStaff", () => {
  const cookieWith = async (seats: StaffIdentity["seats"]) =>
    cookieFrom(await respond(success({}, { staff: { seats, exp: Date.now() + 60_000 } })), STAFF_COOKIE);

  const call = (role: string, cookie: string) =>
    handleStaff(new NextRequest(`${URL_BASE}&role=${role}`, { headers: { cookie } }), (resolved) =>
      success({ resolved }),
    );

  it("exige alguém da equipe na tela pedida e passa quem é", async () => {
    // Equipe da demonstração, que já existe no store em memória.
    const cookie = await cookieWith({ "demo:kitchen": { id: "staff-demo-kitchen", name: "Cozinha da demo" } });
    expect(await (await call("kitchen", cookie)).json()).toEqual({
      resolved: { role: "kitchen", staffId: "staff-demo-kitchen", name: "Cozinha da demo" },
    });
    expect((await call("waiter", cookie)).status).toBe(401);
    expect((await call("customer", cookie)).status).toBe(400);
  });

  it("tira o acesso de quem foi desativado ou não existe mais, mesmo com o cookie válido", async () => {
    const store = getStore("demo");
    const manager = { role: "manager" as const, staffId: "staff-demo-manager" };
    const created = await store.createStaff({ name: "Bruno", role: "waiter" }, manager);
    if (!created.ok) throw new Error(created.error);
    const cookie = await cookieWith({
      "demo:waiter": { id: created.value.member.id, name: "Bruno" },
      "demo:kitchen": { id: "staff-demo-kitchen", name: "Cozinha da demo" },
    });
    expect((await call("waiter", cookie)).status).toBe(200);

    await store.setStaffActive(created.value.member.id, false, manager);
    const response = await call("waiter", cookie);
    expect(response.status).toBe(401);
    // A tela do garçom sai do cookie; a da cozinha continua.
    const next = cookieFrom(response, STAFF_COOKIE);
    expect((await call("waiter", next)).status).toBe(401);
    expect((await call("kitchen", next)).status).toBe(200);

    const ghost = await cookieWith({ "demo:waiter": { id: "ninguem", name: "Ninguém" } });
    expect((await call("waiter", ghost)).status).toBe(401);
  });

  it("responde 404 para restaurante que não existe", async () => {
    const cookie = await cookieWith({ "demo:kitchen": { id: "staff-demo-kitchen", name: "Cozinha da demo" } });
    const response = await handleStaff(
      new NextRequest("http://localhost/api/teste?role=kitchen&r=nao-existe", { headers: { cookie } }),
      () => success({}),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "restaurant_not_found" });
  });

  it("a tela da demo não abre a mesma tela de outro restaurante", async () => {
    let counter = 0;
    const data = newRestaurantData({
      id: "rest-http",
      slug: "cantina-teste-http",
      name: "Cantina Teste",
      ownerUserId: "user-http",
      owner: { staffId: "dono-http", name: "Dono", pin: "717171" },
      createdAt: "2026-11-19T00:00:00.000Z",
      newId: () => `http-${++counter}`,
    });
    expect(await getRegistry().create(data)).toBe(true);
    const cookie = await cookieWith({ "demo:kitchen": { id: "staff-demo-kitchen", name: "Cozinha da demo" } });
    const response = await handleStaff(
      new NextRequest("http://localhost/api/teste?role=kitchen&r=cantina-teste-http", { headers: { cookie } }),
      () => success({}),
    );
    expect(response.status).toBe(401);
  });
});
