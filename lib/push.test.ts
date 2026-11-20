import { describe, expect, it } from "vitest";
import { approvalMessage, callMessage, decodeBase64Url, parseSubscription, readyMessage } from "@/lib/push";
import { TABLES } from "@/lib/seed-data";
import type { SessionSnapshot } from "@/types/store";

const AT = "2026-11-20T20:00:00.000Z";
const snapshot: SessionSnapshot = {
  session: { id: "s1", restaurantId: "r", tableId: "mesa-3", status: "open", openedAt: AT },
  table: TABLES[2],
  tabs: [{ id: "t1", sessionId: "s1", customerName: "Ana", peopleCount: 2, status: "open", approved: false, createdAt: AT }],
  orders: [],
  items: [],
  calls: [],
} as unknown as SessionSnapshot;

describe("parseSubscription", () => {
  it("aceita a inscrição do navegador e recusa o resto", () => {
    const ok = { endpoint: "https://push.example/abc", keys: { p256dh: "chave", auth: "segredo" } };
    expect(parseSubscription(ok)).toEqual({ endpoint: "https://push.example/abc", p256dh: "chave", auth: "segredo" });
    expect(parseSubscription({ ...ok, endpoint: "http://push.example/abc" })).toBeNull();
    expect(parseSubscription({ endpoint: ok.endpoint, keys: { p256dh: "chave" } })).toBeNull();
    expect(parseSubscription(null)).toBeNull();
    expect(parseSubscription({ ...ok, endpoint: `https://x/${"a".repeat(3000)}` })).toBeNull();
  });
});

describe("mensagens", () => {
  it("dizem o que fazer, em qual mesa, e levam para a tela do garçom", () => {
    expect(approvalMessage(snapshot, "t1", "cantina")).toEqual({
      title: "Pedido para confirmar",
      body: "Mesa 3 · Ana",
      tag: "aprovar-t1",
      url: "/r/cantina/garcom",
    });
    expect(approvalMessage(snapshot, "outra", "cantina")).toBeNull();
    const item = { id: "i1", quantity: 2, nameSnapshot: "Chope" } as never;
    expect(readyMessage(snapshot, item, "cantina")).toMatchObject({ title: "Pronto para levar", body: "2× Chope · Mesa 3" });
    const bill = { id: "c1", sessionId: "s1", tabId: "t1", reason: "bill", status: "open", createdAt: AT } as never;
    expect(callMessage(snapshot, bill, "cantina")).toMatchObject({ title: "Pediram a conta", body: "Mesa 3 · Ana · Pedir a conta" });
    const question = { id: "c2", sessionId: "s1", reason: "question", message: "tem sem glúten?", status: "open", createdAt: AT } as never;
    expect(callMessage(snapshot, question, "cantina")).toMatchObject({ title: "Chamaram o garçom", body: "Mesa 3: tem sem glúten?" });
  });
});

describe("decodeBase64Url", () => {
  it("lê base64url sem padding", () => {
    expect([...decodeBase64Url("AQID_w")]).toEqual([1, 2, 3, 255]);
  });
});
