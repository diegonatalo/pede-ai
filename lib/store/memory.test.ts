import { describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/store/memory";
import type { Result } from "@/types/store";

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(`esperava ok, veio ${result.error}`);
  return result.value;
};

const errorOf = <T>(result: Result<T>) => (result.ok ? "ok" : result.error);

/** Store com relógio controlado e ids previsíveis. */
const setup = () => {
  let time = new Date("2026-11-18T20:00:00.000Z").getTime();
  let counter = 0;
  const store = createMemoryStore({
    now: () => new Date(time),
    newId: () => `id-${++counter}`,
  });
  const advance = (minutes: number) => {
    time += minutes * 60_000;
  };
  return { store, advance };
};

/** Mesa 3 aberta pelo garçom, com a comanda de um casal e a de uma amiga. */
const openTable = async () => {
  const context = setup();
  const { store } = context;
  const session = unwrap(await store.openSession("mesa-3", "1234", "waiter"));
  const couple = unwrap(
    await store.createTab({ sessionId: session.id, customerName: "Ana e Rui", peopleCount: 2 }, "customer"),
  );
  const friend = unwrap(
    await store.createTab({ sessionId: session.id, customerName: "Lia", peopleCount: 1 }, "customer"),
  );
  return { ...context, session, couple, friend };
};

describe("cardápio e configuração", () => {
  it("começa com os dados de demonstração", async () => {
    const { store } = setup();
    const menu = await store.getMenu();
    expect(menu.items.length).toBeGreaterThan(0);
    expect((await store.listTables()).length).toBe(8);
    expect((await store.getRestaurant()).requireFirstOrderApproval).toBe(true);
  });

  it("devolve cópias: mexer no resultado não muda o store", async () => {
    const { store } = setup();
    const menu = await store.getMenu();
    menu.items[0].priceCents = 1;
    expect((await store.getMenu()).items[0].priceCents).not.toBe(1);
  });

  it("deixa só a cozinha e o gerente esgotarem um item", async () => {
    const { store } = setup();
    expect(errorOf(await store.setItemAvailability("tiramisu", false, "customer"))).toBe("forbidden");
    expect(unwrap(await store.setItemAvailability("tiramisu", false, "kitchen")).available).toBe(false);
    expect(errorOf(await store.setItemAvailability("nao-existe", false, "kitchen"))).toBe("not_found");
  });

  it("deixa só o gerente mudar taxa e couvert, dentro dos limites", async () => {
    const { store } = setup();
    expect(errorOf(await store.updateRestaurant({ serviceFeePercent: 12 }, "waiter"))).toBe("forbidden");
    expect(errorOf(await store.updateRestaurant({ serviceFeePercent: 12.5 }, "manager"))).toBe("invalid_input");
    expect(errorOf(await store.updateRestaurant({ couvertCents: -1 }, "manager"))).toBe("invalid_input");
    const updated = unwrap(await store.updateRestaurant({ couvertCents: 1500 }, "manager"));
    expect(updated).toMatchObject({ serviceFeePercent: 10, couvertCents: 1500 });
  });
});

describe("sessão da mesa", () => {
  it("é aberta só pela equipe, com código de 4 dígitos, uma por mesa", async () => {
    const { store } = setup();
    expect(errorOf(await store.openSession("mesa-1", "1234", "customer"))).toBe("forbidden");
    expect(errorOf(await store.openSession("mesa-1", "12", "waiter"))).toBe("invalid_input");
    expect(errorOf(await store.openSession("mesa-99", "1234", "waiter"))).toBe("not_found");
    unwrap(await store.openSession("mesa-1", "1234", "waiter"));
    expect(errorOf(await store.openSession("mesa-1", "5678", "waiter"))).toBe("already_open");
    expect((await store.getOpenSessionByTable("mesa-1"))?.tableId).toBe("mesa-1");
    expect(await store.getOpenSessionByTable("mesa-2")).toBeNull();
  });

  it("mostra o código só para a equipe", async () => {
    const { store, session } = await openTable();
    expect(errorOf(await store.getJoinCode(session.id, "customer"))).toBe("forbidden");
    expect(unwrap(await store.getJoinCode(session.id, "waiter"))).toBe("1234");
  });

  it("bloqueia o código depois de 5 erros e libera depois de 5 minutos", async () => {
    const { store, session, advance } = await openTable();
    for (let attempt = 1; attempt < 5; attempt += 1) {
      expect(errorOf(await store.verifyJoinCode(session.id, "0000"))).toBe("wrong_code");
    }
    expect(errorOf(await store.verifyJoinCode(session.id, "0000"))).toBe("locked");
    expect(errorOf(await store.verifyJoinCode(session.id, "1234"))).toBe("locked");
    advance(5);
    expect(unwrap(await store.verifyJoinCode(session.id, "1234"))).toBe(true);
  });

  it("acerto zera os erros", async () => {
    const { store, session } = await openTable();
    for (let attempt = 1; attempt < 5; attempt += 1) await store.verifyJoinCode(session.id, "0000");
    unwrap(await store.verifyJoinCode(session.id, "1234"));
    expect(errorOf(await store.verifyJoinCode(session.id, "0000"))).toBe("wrong_code");
  });

  it("só fecha com todas as comandas pagas ou canceladas, e depois recusa tudo", async () => {
    const { store, session, couple, friend } = await openTable();
    expect(errorOf(await store.closeSession(session.id, "waiter"))).toBe("cannot_close");
    unwrap(await store.setTabStatus(couple.id, "paid", "waiter"));
    unwrap(await store.setTabStatus(friend.id, "canceled", "manager"));
    expect(errorOf(await store.closeSession(session.id, "customer"))).toBe("forbidden");
    expect(unwrap(await store.closeSession(session.id, "waiter")).status).toBe("closed");

    expect(errorOf(await store.verifyJoinCode(session.id, "1234"))).toBe("session_closed");
    expect(
      errorOf(await store.createTab({ sessionId: session.id, customerName: "Zé", peopleCount: 1 }, "customer")),
    ).toBe("session_closed");
    expect(await store.listOpenSessions()).toEqual([]);
    // A mesa pode ser aberta de novo.
    unwrap(await store.openSession("mesa-3", "9999", "waiter"));
  });
});

describe("comandas", () => {
  it("valida nome e número de pessoas", async () => {
    const { store, session } = await openTable();
    const create = (customerName: string, peopleCount: number) =>
      store.createTab({ sessionId: session.id, customerName, peopleCount }, "customer");
    expect(errorOf(await create("   ", 1))).toBe("invalid_input");
    expect(errorOf(await create("a".repeat(41), 1))).toBe("invalid_input");
    expect(errorOf(await create("Bia", 0))).toBe("invalid_input");
    expect(unwrap(await create("  Bia  ", 1)).customerName).toBe("Bia");
  });

  it("nasce sem confirmação quando o cliente abre, e confirmada quando a equipe abre", async () => {
    const { store, session, couple } = await openTable();
    expect(couple.approved).toBe(false);
    const forGrandma = unwrap(
      await store.createTab({ sessionId: session.id, customerName: "Vó", peopleCount: 1 }, "waiter"),
    );
    expect(forGrandma.approved).toBe(true);
  });
});

describe("pedidos", () => {
  it("guarda nome e preço do momento e espera a confirmação no primeiro pedido", async () => {
    const { store, couple } = await openTable();
    const { order, items } = unwrap(
      await store.placeOrder(
        { tabId: couple.id, lines: [{ menuItemId: "carbonara", quantity: 2, note: " sem pimenta " }] },
        "customer",
      ),
    );
    expect(order.tabId).toBe(couple.id);
    expect(items[0]).toMatchObject({
      nameSnapshot: "Espaguete à carbonara",
      unitPriceCents: 5900,
      quantity: 2,
      note: "sem pimenta",
      station: "kitchen",
      status: "awaiting_approval",
      shares: [{ tabId: couple.id, parts: 1 }],
    });
  });

  it("libera os itens ao confirmar a comanda, e os próximos pedidos vão direto", async () => {
    const { store, session, couple } = await openTable();
    unwrap(await store.placeOrder({ tabId: couple.id, lines: [{ menuItemId: "chope", quantity: 2 }] }, "customer"));
    expect(errorOf(await store.approveTab(couple.id, "kitchen"))).toBe("forbidden");
    unwrap(await store.approveTab(couple.id, "waiter"));

    const snapshot = unwrap(await store.getSessionSnapshot(session.id));
    expect(snapshot.items.map((item) => item.status)).toEqual(["sent"]);

    const next = unwrap(
      await store.placeOrder({ tabId: couple.id, lines: [{ menuItemId: "agua", quantity: 1 }] }, "customer"),
    );
    expect(next.items[0]).toMatchObject({ status: "sent", station: "bar" });
  });

  it("manda direto quando a regra de confirmação está desligada", async () => {
    const { store } = setup();
    unwrap(await store.updateRestaurant({ requireFirstOrderApproval: false }, "manager"));
    const session = unwrap(await store.openSession("mesa-1", "1234", "waiter"));
    const tab = unwrap(
      await store.createTab({ sessionId: session.id, customerName: "Ana", peopleCount: 1 }, "customer"),
    );
    const { items } = unwrap(
      await store.placeOrder({ tabId: tab.id, lines: [{ menuItemId: "cafe", quantity: 1 }] }, "customer"),
    );
    expect(items[0].status).toBe("sent");
  });

  it("recusa item esgotado, inexistente, quantidade inválida, pedido vazio e comanda fechada", async () => {
    const { store, couple } = await openTable();
    const order = (lines: { menuItemId: string; quantity: number; note?: string }[]) =>
      store.placeOrder({ tabId: couple.id, lines }, "customer");
    unwrap(await store.setItemAvailability("burrata", false, "kitchen"));
    expect(errorOf(await order([{ menuItemId: "burrata", quantity: 1 }]))).toBe("item_unavailable");
    expect(errorOf(await order([{ menuItemId: "pizza", quantity: 1 }]))).toBe("not_found");
    expect(errorOf(await order([{ menuItemId: "chope", quantity: 0 }]))).toBe("invalid_input");
    expect(errorOf(await order([{ menuItemId: "chope", quantity: 21 }]))).toBe("invalid_input");
    expect(errorOf(await order([{ menuItemId: "chope", quantity: 1, note: "a".repeat(141) }]))).toBe(
      "invalid_input",
    );
    expect(errorOf(await order([]))).toBe("invalid_input");
    expect(errorOf(await store.placeOrder({ tabId: couple.id, lines: [] }, "kitchen"))).toBe("forbidden");

    unwrap(await store.setTabStatus(couple.id, "bill_requested", "customer"));
    expect(errorOf(await order([{ menuItemId: "chope", quantity: 1 }]))).toBe("tab_closed");
  });

  it("não grava nada quando uma linha do pedido é inválida", async () => {
    const { store, session, couple } = await openTable();
    await store.placeOrder(
      { tabId: couple.id, lines: [{ menuItemId: "chope", quantity: 1 }, { menuItemId: "pizza", quantity: 1 }] },
      "customer",
    );
    expect(unwrap(await store.getSessionSnapshot(session.id)).items).toEqual([]);
  });
});

describe("itens", () => {
  const orderOne = async () => {
    const context = await openTable();
    const { store, couple } = context;
    unwrap(await store.approveTab(couple.id, "waiter"));
    const { items } = unwrap(
      await store.placeOrder({ tabId: couple.id, lines: [{ menuItemId: "risoto", quantity: 1 }] }, "customer"),
    );
    return { ...context, item: items[0] };
  };

  it("percorre o caminho da cozinha até a mesa", async () => {
    const { store, item } = await orderOne();
    unwrap(await store.setItemStatus(item.id, "preparing", "kitchen"));
    unwrap(await store.setItemStatus(item.id, "ready", "kitchen"));
    unwrap(await store.setItemStatus(item.id, "picked_up", "waiter"));
    const delivered = unwrap(await store.setItemStatus(item.id, "delivered", "waiter"));
    expect(delivered.status).toBe("delivered");
  });

  it("aplica as permissões de cada papel", async () => {
    const { store, item } = await orderOne();
    expect(errorOf(await store.setItemStatus(item.id, "preparing", "waiter"))).toBe("forbidden");
    expect(errorOf(await store.setItemStatus(item.id, "ready", "kitchen"))).toBe("invalid_transition");
    expect(errorOf(await store.setItemStatus("nao-existe", "ready", "kitchen"))).toBe("not_found");
  });

  it("divide um item entre comandas da mesa", async () => {
    const { store, item, couple, friend } = await orderOne();
    const shares = [
      { tabId: couple.id, parts: 2 },
      { tabId: friend.id, parts: 1 },
    ];
    expect(unwrap(await store.setItemShares(item.id, shares, "customer")).shares).toEqual(shares);
    expect(errorOf(await store.setItemShares(item.id, shares, "kitchen"))).toBe("forbidden");
    expect(errorOf(await store.setItemShares(item.id, [{ tabId: "outra-mesa", parts: 1 }], "customer"))).toBe(
      "unknown_tab",
    );
    expect(errorOf(await store.setItemShares(item.id, [], "customer"))).toBe("empty");
  });

  it("não divide com comanda paga nem item cancelado", async () => {
    const { store, item, couple, friend } = await orderOne();
    unwrap(await store.setTabStatus(friend.id, "paid", "waiter"));
    expect(
      errorOf(
        await store.setItemShares(
          item.id,
          [
            { tabId: couple.id, parts: 1 },
            { tabId: friend.id, parts: 1 },
          ],
          "customer",
        ),
      ),
    ).toBe("unknown_tab");
    unwrap(await store.setItemStatus(item.id, "canceled", "customer"));
    expect(errorOf(await store.setItemShares(item.id, [{ tabId: couple.id, parts: 1 }], "waiter"))).toBe(
      "invalid_transition",
    );
  });
});

describe("linha do tempo e relatório", () => {
  it("guarda quando o item entrou em cada estado", async () => {
    const { store, couple, advance } = await openTable();
    const { items } = unwrap(
      await store.placeOrder({ tabId: couple.id, lines: [{ menuItemId: "risoto", quantity: 1 }] }, "customer"),
    );
    expect(Object.keys(items[0].timeline)).toEqual(["awaiting_approval"]);
    advance(1);
    unwrap(await store.approveTab(couple.id, "waiter"));
    advance(2);
    unwrap(await store.setItemStatus(items[0].id, "preparing", "kitchen"));
    advance(12);
    const ready = unwrap(await store.setItemStatus(items[0].id, "ready", "kitchen"));
    expect(ready.timeline).toEqual({
      awaiting_approval: "2026-11-18T20:00:00.000Z",
      sent: "2026-11-18T20:01:00.000Z",
      preparing: "2026-11-18T20:03:00.000Z",
      ready: "2026-11-18T20:15:00.000Z",
    });
  });

  it("lista para o gerente as mesas abertas e as fechadas desde o início do dia", async () => {
    const { store, session, couple, friend, advance } = await openTable();
    unwrap(await store.setTabStatus(couple.id, "paid", "waiter"));
    unwrap(await store.setTabStatus(friend.id, "paid", "waiter"));
    unwrap(await store.closeSession(session.id, "waiter"));
    advance(60);
    unwrap(await store.openSession("mesa-1", "1111", "waiter"));

    const today = unwrap(await store.listSessionsSince("2026-11-18T03:00:00.000Z", "manager"));
    expect(today.map((entry) => [entry.table.id, entry.session.status])).toEqual([
      ["mesa-3", "closed"],
      ["mesa-1", "open"],
    ]);
    // A mesa fechada antes do período fica de fora; a aberta aparece sempre.
    const later = unwrap(await store.listSessionsSince("2026-11-18T20:30:00.000Z", "manager"));
    expect(later.map((entry) => entry.table.id)).toEqual(["mesa-1"]);

    expect(errorOf(await store.listSessionsSince("2026-11-18T03:00:00.000Z", "waiter"))).toBe("forbidden");
    expect(errorOf(await store.listSessionsSince("ontem", "manager"))).toBe("invalid_input");
  });
});

describe("chamados", () => {
  it("cria e resolve um chamado da comanda", async () => {
    const { store, session, couple } = await openTable();
    const call = unwrap(
      await store.createCall({ sessionId: session.id, tabId: couple.id, reason: "bill" }, "customer"),
    );
    expect(call).toMatchObject({ status: "open", reason: "bill", tabId: couple.id });
    unwrap(await store.setCallStatus(call.id, "acknowledged", "waiter"));
    expect(unwrap(await store.setCallStatus(call.id, "resolved", "waiter")).status).toBe("resolved");
  });

  it("recusa motivo inválido, mensagem longa e comanda de outra mesa", async () => {
    const { store, session } = await openTable();
    const other = unwrap(await store.openSession("mesa-5", "4321", "waiter"));
    const stranger = unwrap(
      await store.createTab({ sessionId: other.id, customerName: "Zé", peopleCount: 1 }, "customer"),
    );
    expect(
      errorOf(await store.createCall({ sessionId: session.id, reason: "pizza" as "bill" }, "customer")),
    ).toBe("invalid_input");
    expect(
      errorOf(
        await store.createCall({ sessionId: session.id, reason: "other", message: "a".repeat(281) }, "customer"),
      ),
    ).toBe("invalid_input");
    expect(
      errorOf(await store.createCall({ sessionId: session.id, tabId: stranger.id, reason: "question" }, "customer")),
    ).toBe("not_found");
  });
});

describe("eventos", () => {
  it("registra cada mudança em ordem e filtra por sessão", async () => {
    const { store, session, couple } = await openTable();
    const other = unwrap(await store.openSession("mesa-5", "4321", "waiter"));
    unwrap(await store.placeOrder({ tabId: couple.id, lines: [{ menuItemId: "cafe", quantity: 1 }] }, "customer"));

    const all = await store.getEvents(0);
    expect(all.events.map((event) => event.type)).toEqual([
      "session_opened",
      "tab_created",
      "tab_created",
      "session_opened",
      "order_placed",
    ]);
    expect(all.lastSeq).toBe(5);

    const mine = await store.getEvents(0, session.id);
    expect(mine.events.every((event) => event.sessionId === session.id)).toBe(true);
    expect((await store.getEvents(0, other.id)).events).toHaveLength(1);

    const newer = await store.getEvents(3);
    expect(newer.events.map((event) => event.seq)).toEqual([4, 5]);
  });

  it("não registra evento quando o comando falha", async () => {
    const { store } = setup();
    await store.openSession("mesa-1", "1", "waiter");
    expect((await store.getEvents(0)).lastSeq).toBe(0);
  });
});
