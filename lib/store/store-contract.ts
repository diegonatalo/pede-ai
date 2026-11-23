import { describe, expect, it } from "vitest";
import type { EngineOptions } from "@/lib/store/engine";
import type { Result, Store } from "@/types/store";

/**
 * Contrato do store: o mesmo conjunto de testes roda contra cada repositório
 * (memória sempre; Postgres quando há banco de teste). Cada teste espera um banco vazio.
 */
export const describeStoreContract = (makeStore: (options: EngineOptions) => Store) => {
  const unwrap = <T>(result: Result<T>): T => {
    if (!result.ok) throw new Error(`esperava ok, veio ${result.error}`);
    return result.value;
  };

  const errorOf = <T>(result: Result<T>) => (result.ok ? "ok" : result.error);

  /** Store com relógio controlado, ids previsíveis e, se pedido, PINs da equipe em sequência. */
  const setup = (pins: string[] = []) => {
    let time = new Date("2026-11-18T20:00:00.000Z").getTime();
    let counter = 0;
    let pinIndex = 0;
    const store = makeStore({
      now: () => new Date(time),
      newId: () => `id-${++counter}`,
      ...(pins.length > 0 && { newPin: () => pins[Math.min(pinIndex++, pins.length - 1)] }),
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

    it("deixa só o gerente editar o cardápio, que continua igual ao ler de novo", async () => {
      const { store } = setup();
      expect(errorOf(await store.editMenu({ type: "save_category", name: "Petiscos" }, "waiter"))).toBe("forbidden");
      unwrap(await store.editMenu({ type: "save_category", name: "Petiscos" }, "manager"));
      const before = await store.getMenu();
      const petiscos = before.categories.at(-1);
      expect(petiscos?.name).toBe("Petiscos");
      const id = petiscos?.id as string;

      unwrap(
        await store.editMenu(
          { type: "save_item", categoryId: id, name: "Batata frita", description: "Porção", priceCents: 2800, station: "kitchen" },
          "manager",
        ),
      );
      unwrap(await store.editMenu({ type: "move_category", id, direction: "up" }, "manager"));
      unwrap(await store.editMenu({ type: "save_item", id: "chope", categoryId: id, name: "Chope", description: "", priceCents: 1300, station: "bar" }, "manager"));
      unwrap(await store.editMenu({ type: "move_item", id: "chope", direction: "up" }, "manager"));
      unwrap(await store.editMenu({ type: "delete_item", id: "tiramisu" }, "manager"));

      const after = await store.getMenu();
      const order = after.categories.map((category) => category.name);
      expect(order.at(-2)).toBe("Petiscos");
      expect(after.categories.map((category) => category.position)).toEqual(after.categories.map((_, index) => index));
      expect(after.items.filter((item) => item.categoryId === id).map((item) => item.name)).toEqual(["Chope", "Batata frita"]);
      expect(after.items.find((item) => item.id === "chope")?.priceCents).toBe(1300);
      expect(after.items.some((item) => item.id === "tiramisu")).toBe(false);
      expect(errorOf(await store.editMenu({ type: "delete_category", id }, "manager"))).toBe("category_not_empty");
      expect((await store.getEvents(0)).events.filter((event) => event.type === "menu_updated")).toHaveLength(6);
    });

    it("deixa só o gerente editar mesas e mapa, guardando a mesa arquivada para o histórico", async () => {
      const { store } = setup();
      expect(errorOf(await store.editFloor({ type: "save_table", label: "Varanda" }, "waiter"))).toBe("forbidden");
      const created = unwrap(await store.editFloor({ type: "save_table", label: "Varanda" }, "manager"));
      const varanda = created.tables.at(-1);
      expect(varanda?.label).toBe("Varanda");
      unwrap(await store.editFloor({ type: "move_table", id: varanda?.id as string, direction: "up" }, "manager"));
      unwrap(await store.editFloor({ type: "save_table", id: "mesa-2", label: "Mesa 20" }, "manager"));
      expect((await store.listTables()).map((table) => table.label).slice(-3)).toEqual(["Mesa 7", "Varanda", "Mesa 8"]);
      expect((await store.listMapSpots()).find((spot) => spot.tableId === "mesa-2")?.label).toBe("20");

      // Mesa aberta não sai do salão; fechada, sai, mas a sessão antiga continua no histórico.
      const session = unwrap(await store.openSession("mesa-3", "1234", "waiter"));
      expect(errorOf(await store.editFloor({ type: "archive_table", id: "mesa-3" }, "manager"))).toBe("table_in_use");
      unwrap(await store.closeSession(session.id, "waiter"));
      unwrap(await store.editFloor({ type: "archive_table", id: "mesa-3" }, "manager"));
      expect((await store.listTables()).some((table) => table.id === "mesa-3")).toBe(false);
      expect((await store.listMapSpots()).some((spot) => spot.tableId === "mesa-3")).toBe(false);
      expect(errorOf(await store.openSession("mesa-3", "1234", "waiter"))).toBe("not_found");
      const history = unwrap(await store.listSessionsSince("2000-01-01T00:00:00.000Z", "manager"));
      expect(history.find((entry) => entry.session.id === session.id)?.table.label).toBe("Mesa 3");

      // O mapa é trocado de uma vez; sem pontos, o mapa some.
      const map = unwrap(
        await store.editFloor(
          { type: "save_map", spots: [{ kind: "table", tableId: "mesa-1", x: 0, y: 0, w: 10, h: 10 }, { kind: "cashier", x: 0, y: 90, w: 20, h: 10 }] },
          "manager",
        ),
      );
      expect(map.mapSpots.map((spot) => [spot.kind, spot.label])).toEqual([["table", "1"], ["cashier", "Caixa"]]);
      expect((await store.listMapSpots()).map((spot) => spot.label)).toEqual(["1", "Caixa"]);
      unwrap(await store.editFloor({ type: "save_map", spots: [] }, "manager"));
      expect(await store.listMapSpots()).toEqual([]);
      expect((await store.getEvents(0)).events.filter((event) => event.type === "floor_updated")).toHaveLength(6);
    });

    it("deixa só o gerente mudar taxa e couvert, dentro dos limites", async () => {
      const { store } = setup();
      expect(errorOf(await store.updateRestaurant({ serviceFeePercent: 12 }, "waiter"))).toBe("forbidden");
      expect(errorOf(await store.updateRestaurant({ serviceFeePercent: 12.5 }, "manager"))).toBe("invalid_input");
      expect(errorOf(await store.updateRestaurant({ couvertCents: -1 }, "manager"))).toBe("invalid_input");
      expect(errorOf(await store.updateRestaurant({ name: " x " }, "manager"))).toBe("invalid_input");
      expect(unwrap(await store.updateRestaurant({ name: "  Cantina   Nova " }, "manager")).name).toBe("Cantina Nova");
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

  describe("equipe", () => {
    const manager = { role: "manager" as const, staffId: "staff-demo-manager" };

    it("começa com a equipe da demonstração, que só o gerente lista", async () => {
      const { store } = setup();
      const team = unwrap(await store.listStaff("manager"));
      expect(team.map((member) => [member.role, member.system, member.active])).toEqual([
        ["kitchen", true, true],
        ["waiter", true, true],
        ["manager", true, true],
      ]);
      expect(JSON.stringify(team)).not.toMatch(/1111|2222|3333/);
      expect(errorOf(await store.listStaff("waiter"))).toBe("forbidden");
    });

    it("entra com o PIN da pessoa e recusa PIN errado", async () => {
      const { store } = setup();
      expect(unwrap(await store.verifyStaffPin("2222"))).toMatchObject({ role: "waiter", name: "Garçom da demo" });
      expect(errorOf(await store.verifyStaffPin("9999"))).toBe("wrong_pin");
      expect(errorOf(await store.verifyStaffPin("abc"))).toBe("wrong_pin");
    });

    it("bloqueia o login da equipe depois de muitos erros seguidos, por alguns minutos", async () => {
      const { store, advance } = setup();
      for (let attempt = 1; attempt <= 20; attempt += 1) {
        expect(errorOf(await store.verifyStaffPin("9999"))).toBe("wrong_pin");
      }
      expect(errorOf(await store.verifyStaffPin("9999"))).toBe("locked");
      expect(errorOf(await store.verifyStaffPin("2222"))).toBe("locked");
      advance(2);
      expect(unwrap(await store.verifyStaffPin("2222")).role).toBe("waiter");
    });

    it("um PIN certo zera a contagem de erros", async () => {
      const { store } = setup();
      for (let attempt = 1; attempt <= 19; attempt += 1) await store.verifyStaffPin("9999");
      expect(unwrap(await store.verifyStaffPin("2222")).role).toBe("waiter");
      for (let attempt = 1; attempt <= 20; attempt += 1) {
        expect(errorOf(await store.verifyStaffPin("9999"))).toBe("wrong_pin");
      }
      expect(errorOf(await store.verifyStaffPin("9999"))).toBe("locked");
    });

    it("muitas tentativas ao mesmo tempo não passam do limite", async () => {
      const { store } = setup();
      const pins = Array.from({ length: 200 }, (_, i) => String(900000 + i));
      const results = await Promise.all(pins.map((pin) => store.verifyStaffPin(pin)));
      // só 20 PINs chegam a ser conferidos; as outras tentativas encontram o login bloqueado
      expect(results.filter((result) => errorOf(result) === "wrong_pin")).toHaveLength(20);
      expect(results.filter((result) => errorOf(result) === "locked")).toHaveLength(180);
      expect(errorOf(await store.verifyStaffPin("2222"))).toBe("locked");
    });

    it("cadastra a pessoa com um PIN novo, sorteando outro se o primeiro já for de alguém", async () => {
      const { store } = setup(["482913", "482913", "650127"]);
      const first = unwrap(await store.createStaff({ name: " Bruno ", role: "waiter" }, manager));
      expect(first).toMatchObject({ pin: "482913", member: { name: "Bruno", role: "waiter", active: true, system: false } });
      const second = unwrap(await store.createStaff({ name: "Carla", role: "kitchen" }, manager));
      expect(second.pin).toBe("650127");
      expect(unwrap(await store.verifyStaffPin("482913")).name).toBe("Bruno");
      expect(unwrap(await store.verifyStaffPin("650127")).name).toBe("Carla");
    });

    it("só o gerente cadastra, com nome e papel válidos", async () => {
      const { store } = setup();
      expect(errorOf(await store.createStaff({ name: "Zé", role: "waiter" }, "waiter"))).toBe("forbidden");
      expect(errorOf(await store.createStaff({ name: "  ", role: "waiter" }, manager))).toBe("invalid_input");
      expect(errorOf(await store.createStaff({ name: "Zé", role: "customer" as "waiter" }, manager))).toBe("invalid_input");
    });

    it("troca o PIN: o antigo para de funcionar", async () => {
      const { store } = setup(["111222", "333444"]);
      const { member } = unwrap(await store.createStaff({ name: "Bruno", role: "waiter" }, manager));
      const reset = unwrap(await store.resetStaffPin(member.id, manager));
      expect(reset.pin).toBe("333444");
      expect(errorOf(await store.verifyStaffPin("111222"))).toBe("wrong_pin");
      expect(unwrap(await store.verifyStaffPin("333444")).id).toBe(member.id);
      expect(errorOf(await store.resetStaffPin("staff-demo-waiter", manager))).toBe("forbidden");
    });

    it("desativa e reativa quem saiu, mas não a equipe da demo nem a si mesmo", async () => {
      const { store } = setup(["555666", "777888"]);
      const { member } = unwrap(await store.createStaff({ name: "Bruno", role: "waiter" }, manager));
      expect(unwrap(await store.setStaffActive(member.id, false, manager)).active).toBe(false);
      expect(errorOf(await store.verifyStaffPin("555666"))).toBe("wrong_pin");
      unwrap(await store.setStaffActive(member.id, true, manager));
      expect(unwrap(await store.verifyStaffPin("555666")).id).toBe(member.id);

      expect(errorOf(await store.setStaffActive("staff-demo-waiter", false, manager))).toBe("forbidden");
      unwrap(await store.setStaffActive(member.id, false, manager));
      expect((await store.getStaffMember(member.id))?.active).toBe(false);
      expect(await store.getStaffMember("ninguem")).toBeNull();
      const { member: boss } = unwrap(await store.createStaff({ name: "Dona", role: "manager" }, manager));
      expect(errorOf(await store.setStaffActive(boss.id, false, { role: "manager", staffId: boss.id }))).toBe("forbidden");
    });

    it("grava quem da equipe fez cada ação", async () => {
      const { store } = setup();
      const waiter = { role: "waiter" as const, staffId: "staff-demo-waiter" };
      const session = unwrap(await store.openSession("mesa-2", "1234", waiter));
      unwrap(await store.createTab({ sessionId: session.id, customerName: "Ana", peopleCount: 1 }, "customer"));
      const { events } = await store.getEvents(0);
      expect(events.map((entry) => [entry.type, entry.actor, entry.actorStaffId])).toEqual([
        ["session_opened", "waiter", "staff-demo-waiter"],
        ["tab_created", "customer", undefined],
      ]);
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
};
