// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { CUSTOMER_COOKIE, STAFF_COOKIE, handleCustomer, handleStaff, respond } from "@/lib/api/http";
import { error, success } from "@/lib/api/result";

const URL_BASE = "http://localhost/api/teste";

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
  it("exige o papel na URL e no cookie", async () => {
    const saved = await respond(success({}, { staff: { roles: ["kitchen"], exp: Date.now() + 60_000 } }));
    const cookie = cookieFrom(saved, STAFF_COOKIE);
    const call = (role: string) =>
      handleStaff(new NextRequest(`${URL_BASE}?role=${role}`, { headers: { cookie } }), (resolved) =>
        success({ resolved }),
      );
    expect(await (await call("kitchen")).json()).toEqual({ resolved: "kitchen" });
    expect((await call("waiter")).status).toBe(401);
    expect((await call("customer")).status).toBe(400);
  });
});
