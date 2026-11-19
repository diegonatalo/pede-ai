import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "@/lib/signed-token";

const SECRET = "segredo-de-teste";

describe("signToken e verifyToken", () => {
  it("devolve o conteúdo assinado", async () => {
    const token = await signToken({ sessionId: "s1", tabIds: ["t1"] }, SECRET);
    expect(await verifyToken(token, SECRET)).toEqual({ sessionId: "s1", tabIds: ["t1"] });
  });

  it("recusa token alterado", async () => {
    const token = await signToken({ roles: ["waiter"] }, SECRET);
    const [, signature] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ roles: ["manager"] })).toString("base64url")}.${signature}`;
    expect(await verifyToken(forged, SECRET)).toBeNull();
  });

  it("recusa token assinado com outra chave", async () => {
    const token = await signToken({ a: 1 }, "outra-chave");
    expect(await verifyToken(token, SECRET)).toBeNull();
  });

  it.each([undefined, "", "abc", "a.b.c", "!!!.???"])("recusa %j", async (token) => {
    expect(await verifyToken(token, SECRET)).toBeNull();
  });
});
