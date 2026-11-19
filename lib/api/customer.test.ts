import { describe, expect, it } from "vitest";
import {
  createCustomerCall,
  createCustomerTab,
  getCustomerFeed,
  getCustomerView,
  getTableStatus,
  joinTable,
  placeCustomerOrder,
  setCustomerCallStatus,
  setCustomerItemShares,
  setCustomerItemStatus,
  setCustomerTabStatus,
} from "@/lib/api/customer";
import type { CustomerIdentity } from "@/lib/api/identity";
import type { ApiResult } from "@/lib/api/result";
import { createMemoryStore } from "@/lib/store/memory";
import type { CustomerView } from "@/lib/views";
import type { OrderItem, Tab, WaiterCall } from "@/types/domain";
import type { Store } from "@/types/store";

const NOW = Date.parse("2026-11-18T20:00:00.000Z");

const errorOf = (result: ApiResult) => (result.body as { error?: string }).error ?? "ok";

/** Mesa 3 aberta com o código 1234 e dois celulares: o casal e a amiga. */
const setup = async () => {
  const store: Store = createMemoryStore();
  const opened = await store.openSession("mesa-3", "1234", "waiter");
  if (!opened.ok) throw new Error(opened.error);

  const join = async () => {
    const result = await joinTable(store, null, "mesa-3", { code: "1234" }, NOW);
    return result.customer as CustomerIdentity;
  };
  const openTab = async (identity: CustomerIdentity, customerName: string, peopleCount = 1) => {
    const result = await createCustomerTab(store, identity, { customerName, peopleCount }, NOW);
    return { identity: result.customer as CustomerIdentity, tab: result.body as Tab };
  };

  const couple = await openTab(await join(), "Ana e Rui", 2);
  const friend = await openTab(await join(), "Lia");
  return { store, sessionId: opened.value.id, couple, friend, join, openTab };
};

const order = async (store: Store, identity: CustomerIdentity, tabId: string, menuItemId = "risoto") => {
  const result = await placeCustomerOrder(store, identity, { tabId, lines: [{ menuItemId, quantity: 1 }] });
  return (result.body as { items: OrderItem[] }).items[0];
};

describe("entrada na mesa", () => {
  it("diz se a mesa está aberta, sem mostrar o código", async () => {
    const { store } = await setup();
    const open = await getTableStatus(store, "mesa-3");
    expect(open.body).toMatchObject({ open: true, table: { id: "mesa-3" } });
    expect(JSON.stringify(open.body)).not.toContain("1234");
    expect((await getTableStatus(store, "mesa-1")).body).toMatchObject({ open: false });
    expect((await getTableStatus(store, "mesa-99")).status).toBe(404);
  });

  it("entra com o código certo e grava o cookie", async () => {
    const { store, sessionId } = await setup();
    const result = await joinTable(store, null, "mesa-3", { code: " 1234 " }, NOW);
    expect(result.status).toBe(200);
    expect(result.customer).toMatchObject({ sessionId, tabIds: [] });
    expect(result.customer?.exp).toBeGreaterThan(NOW);
  });

  it("recusa código errado, mesa fechada e corpo inválido", async () => {
    const { store } = await setup();
    expect(await joinTable(store, null, "mesa-3", { code: "0000" }, NOW)).toMatchObject({ status: 401 });
    expect(errorOf(await joinTable(store, null, "mesa-1", { code: "1234" }, NOW))).toBe("session_closed");
    expect(errorOf(await joinTable(store, null, "mesa-3", { codigo: "1234" }, NOW))).toBe("invalid_input");
  });

  it("mantém as comandas ao entrar de novo na mesma mesa", async () => {
    const { store, couple } = await setup();
    const again = await joinTable(store, couple.identity, "mesa-3", { code: "1234" }, NOW);
    expect(again.customer?.tabIds).toEqual(couple.identity.tabIds);
  });
});

describe("comanda e visão do cliente", () => {
  it("exige ter entrado na mesa", async () => {
    const { store } = await setup();
    expect(errorOf(await getCustomerView(store, null))).toBe("not_joined");
    expect(errorOf(await createCustomerTab(store, null, { customerName: "Zé", peopleCount: 1 }, NOW))).toBe(
      "not_joined",
    );
  });

  it("guarda a comanda nova no cookie, sem perder as anteriores", async () => {
    const { couple, openTab } = await setup();
    const forGrandma = await openTab(couple.identity, "Vó");
    expect(forGrandma.identity.tabIds).toEqual([couple.tab.id, forGrandma.tab.id]);
  });

  it("mostra os nomes da mesa, mas só os próprios pedidos", async () => {
    const { store, couple, friend } = await setup();
    await order(store, couple.identity, couple.tab.id, "parmegiana");
    await order(store, friend.identity, friend.tab.id, "risoto");
    const view = (await getCustomerView(store, friend.identity)).body as CustomerView & { lastSeq: number };
    expect(view.tabs.map((tab) => [tab.customerName, tab.mine])).toEqual([
      ["Ana e Rui", false],
      ["Lia", true],
    ]);
    expect(view.items.map((item) => item.menuItemId)).toEqual(["risoto"]);
    expect(view.restaurant.serviceFeePercent).toBe(10);
    expect(view.lastSeq).toBeGreaterThan(0);
  });

  it("apaga o cookie quando a mesa fecha", async () => {
    const { store, sessionId, couple, friend } = await setup();
    await store.setTabStatus(couple.tab.id, "paid", "waiter");
    await store.setTabStatus(friend.tab.id, "paid", "waiter");
    await store.closeSession(sessionId, "waiter");
    const result = await getCustomerView(store, couple.identity);
    expect(errorOf(result)).toBe("session_closed");
    expect(result.customer).toBeNull();
  });
});

describe("pedidos e itens", () => {
  it("só pede na própria comanda", async () => {
    const { store, couple, friend } = await setup();
    const result = await placeCustomerOrder(store, friend.identity, {
      tabId: couple.tab.id,
      lines: [{ menuItemId: "chope", quantity: 1 }],
    });
    expect(errorOf(result)).toBe("forbidden");
  });

  it("valida a forma do pedido", async () => {
    const { store, couple } = await setup();
    const send = (body: unknown) => placeCustomerOrder(store, couple.identity, body);
    expect(errorOf(await send({ tabId: couple.tab.id }))).toBe("invalid_input");
    expect(errorOf(await send({ tabId: couple.tab.id, lines: [{ menuItemId: "chope" }] }))).toBe("invalid_input");
    expect(
      errorOf(await send({ tabId: couple.tab.id, lines: [{ menuItemId: "chope", quantity: 1, note: 5 }] })),
    ).toBe("invalid_input");
  });

  it("cancela o próprio item, mas não o dos outros", async () => {
    const { store, couple, friend } = await setup();
    const item = await order(store, couple.identity, couple.tab.id);
    expect(errorOf(await setCustomerItemStatus(store, friend.identity, item.id, { to: "canceled" }))).toBe(
      "forbidden",
    );
    expect((await setCustomerItemStatus(store, couple.identity, item.id, { to: "canceled" })).status).toBe(200);
  });

  it("não deixa o cliente avançar o preparo", async () => {
    const { store, couple } = await setup();
    const item = await order(store, couple.identity, couple.tab.id);
    expect(errorOf(await setCustomerItemStatus(store, couple.identity, item.id, { to: "sent" }))).toBe("forbidden");
  });

  it("divide o próprio item com a amiga, que passa a ver a parte dela", async () => {
    const { store, couple, friend } = await setup();
    const item = await order(store, couple.identity, couple.tab.id, "burrata");
    const shares = [
      { tabId: couple.tab.id, parts: 2 },
      { tabId: friend.tab.id, parts: 1 },
    ];
    expect(errorOf(await setCustomerItemShares(store, friend.identity, item.id, { shares }))).toBe("forbidden");
    expect((await setCustomerItemShares(store, couple.identity, item.id, { shares })).status).toBe(200);
    const view = (await getCustomerView(store, friend.identity)).body as CustomerView;
    expect(view.items.map((entry) => entry.id)).toEqual([item.id]);
  });

  it("pede a conta só da própria comanda", async () => {
    const { store, couple, friend } = await setup();
    expect(errorOf(await setCustomerTabStatus(store, friend.identity, couple.tab.id, { to: "bill_requested" }))).toBe(
      "forbidden",
    );
    expect((await setCustomerTabStatus(store, couple.identity, couple.tab.id, { to: "bill_requested" })).status).toBe(
      200,
    );
  });
});

describe("chamados e feed", () => {
  it("chama o garçom pela própria comanda e desiste do chamado", async () => {
    const { store, couple, friend } = await setup();
    const created = await createCustomerCall(store, couple.identity, { tabId: couple.tab.id, reason: "question" });
    const call = created.body as WaiterCall;
    expect(call.status).toBe("open");
    expect(errorOf(await createCustomerCall(store, friend.identity, { tabId: couple.tab.id, reason: "bill" }))).toBe(
      "forbidden",
    );
    expect(errorOf(await setCustomerCallStatus(store, friend.identity, call.id, { to: "resolved" }))).toBe(
      "forbidden",
    );
    expect((await setCustomerCallStatus(store, couple.identity, call.id, { to: "resolved" })).status).toBe(200);
  });

  it("avisa quando algo mudou na mesa", async () => {
    const { store, couple } = await setup();
    const first = (await getCustomerFeed(store, couple.identity, 0)).body as { lastSeq: number; changed: boolean };
    expect(first.changed).toBe(true);
    const idle = (await getCustomerFeed(store, couple.identity, first.lastSeq)).body as { changed: boolean };
    expect(idle.changed).toBe(false);
    await order(store, couple.identity, couple.tab.id);
    const after = (await getCustomerFeed(store, couple.identity, first.lastSeq)).body as { changed: boolean };
    expect(after.changed).toBe(true);
  });

  it("não acorda com mudanças de outra mesa", async () => {
    const { store, couple } = await setup();
    const { lastSeq } = (await getCustomerFeed(store, couple.identity, 0)).body as { lastSeq: number };
    await store.openSession("mesa-5", "4321", "waiter");
    const feed = (await getCustomerFeed(store, couple.identity, lastSeq)).body as { changed: boolean };
    expect(feed.changed).toBe(false);
  });
});
