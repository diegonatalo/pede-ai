import { describe, expect, it } from "vitest";
import { newRestaurantData } from "@/lib/restaurant-template";
import type { RestaurantRegistry, Result, Store } from "@/types/store";

/** O que o teste precisa: o cadastro e um store para qualquer restaurante, no mesmo banco. */
export type TenantWorld = { registry: RestaurantRegistry; storeFor: (restaurantId: string) => Store };

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(`esperava ok, veio ${result.error}`);
  return result.value;
};

const errorOf = <T>(result: Result<T>) => (result.ok ? "ok" : result.error);

/**
 * Contrato de isolamento: dois restaurantes no mesmo banco, e nada de um aparece ou muda no outro.
 * Roda na memória e no Postgres. Cada teste espera um banco só com a demonstração.
 */
export const describeIsolationContract = (makeWorld: () => TenantWorld) => {
  /** Demo (A) e um restaurante novo (B, do dono "user-b"), com uma mesa aberta e um pedido em A. */
  const setup = async () => {
    const world = makeWorld();
    let counter = 0;
    const data = newRestaurantData({
      id: "rest-b",
      slug: "cantina-b",
      name: "Cantina B",
      ownerUserId: "user-b",
      owner: { staffId: "dono-b", name: "Dono B", pin: "707070" },
      createdAt: "2026-11-19T00:00:00.000Z",
      newId: () => `b-${++counter}`,
    });
    expect(await world.registry.create(data)).toBe(true);
    const a = world.storeFor("demo");
    const b = world.storeFor("rest-b");

    const waiter = { role: "waiter" as const, staffId: "staff-demo-waiter" };
    const session = unwrap(await a.openSession("mesa-3", "1234", waiter));
    const tab = unwrap(await a.createTab({ sessionId: session.id, customerName: "Ana", peopleCount: 1 }, waiter));
    const { items } = unwrap(await a.placeOrder({ tabId: tab.id, lines: [{ menuItemId: "chope", quantity: 1 }] }, waiter));
    const call = unwrap(await a.createCall({ sessionId: session.id, tabId: tab.id, reason: "question" }, "customer"));
    return { world, data, a, b, session, tab, item: items[0], call };
  };

  describe("cadastro de restaurantes", () => {
    it("cria, acha pelo endereço e pelo dono, e recusa endereço repetido", async () => {
      const { world, data } = await setup();
      expect(await world.registry.findBySlug("cantina-b")).toEqual({
        id: "rest-b",
        slug: "cantina-b",
        name: "Cantina B",
        ownerUserId: "user-b",
      });
      expect(await world.registry.findBySlug("demo")).toMatchObject({ id: "demo", ownerUserId: null });
      expect(await world.registry.findBySlug("nao-existe")).toBeNull();
      expect((await world.registry.listByOwner("user-b")).map((entry) => entry.id)).toEqual(["rest-b"]);
      expect(await world.registry.listByOwner("ninguem")).toEqual([]);

      const copy = { ...data, restaurant: { ...data.restaurant, id: "rest-c" } };
      expect(await world.registry.create(copy)).toBe(false);
    });
  });

  describe("isolamento entre restaurantes", () => {
    it("cada restaurante vê só o próprio salão, cardápio e equipe", async () => {
      const { a, b, data } = await setup();
      expect((await b.getRestaurant()).slug).toBe("cantina-b");
      expect((await b.listTables()).map((table) => table.id)).toEqual(data.tables.map((table) => table.id));
      expect((await b.getMenu()).items.map((item) => item.id)).toEqual(data.menuItems.map((item) => item.id));
      expect(unwrap(await b.listStaff("manager")).map((member) => member.name)).toEqual(["Dono B"]);
      expect((await a.listTables()).some((table) => table.id.startsWith("b-"))).toBe(false);
      expect(unwrap(await a.listStaff("manager")).some((member) => member.id === "dono-b")).toBe(false);
    });

    it("não acha nem mexe na mesa, comanda, item e chamado de outro restaurante", async () => {
      const { b, session, tab, item, call } = await setup();
      expect(await b.getOpenSessionByTable("mesa-3")).toBeNull();
      expect(errorOf(await b.getSessionSnapshot(session.id))).toBe("not_found");
      expect(await b.listOpenSessions()).toEqual([]);
      expect(errorOf(await b.getJoinCode(session.id, "waiter"))).toBe("not_found");
      expect(errorOf(await b.verifyJoinCode(session.id, "1234"))).toBe("not_found");
      expect(errorOf(await b.setTabStatus(tab.id, "paid", "manager"))).toBe("not_found");
      expect(errorOf(await b.approveTab(tab.id, "manager"))).toBe("not_found");
      expect(errorOf(await b.placeOrder({ tabId: tab.id, lines: [{ menuItemId: "chope", quantity: 1 }] }, "manager"))).toBe(
        "not_found",
      );
      expect(errorOf(await b.setItemStatus(item.id, "preparing", "kitchen"))).toBe("not_found");
      expect(errorOf(await b.setItemShares(item.id, [{ tabId: tab.id, parts: 1 }], "manager"))).toBe("not_found");
      expect(errorOf(await b.setCallStatus(call.id, "resolved", "manager"))).toBe("not_found");
      expect(errorOf(await b.createCall({ sessionId: session.id, reason: "bill" }, "customer"))).toBe("not_found");
      expect(errorOf(await b.closeSession(session.id, "manager"))).toBe("not_found");
      expect(unwrap(await b.listSessionsSince("2000-01-01T00:00:00.000Z", "manager"))).toEqual([]);
    });

    it("não abre mesa nem pede item de outro restaurante", async () => {
      const { b } = await setup();
      expect(errorOf(await b.openSession("mesa-1", "1234", "manager"))).toBe("not_found");
      const [table] = await b.listTables();
      const session = unwrap(await b.openSession(table.id, "4321", "manager"));
      const tab = unwrap(await b.createTab({ sessionId: session.id, customerName: "Zé", peopleCount: 1 }, "manager"));
      // "chope" é o id do item na demo; no restaurante B os itens têm ids próprios.
      expect(errorOf(await b.placeOrder({ tabId: tab.id, lines: [{ menuItemId: "chope", quantity: 1 }] }, "manager"))).toBe(
        "not_found",
      );
      expect(errorOf(await b.setItemAvailability("chope", false, "manager"))).toBe("not_found");
    });

    it("separa os eventos de cada restaurante", async () => {
      const { a, b } = await setup();
      const before = await a.getEvents(0);
      expect(before.events.length).toBeGreaterThan(0);
      expect((await b.getEvents(0)).events).toEqual([]);

      const [table] = await b.listTables();
      unwrap(await b.openSession(table.id, "4321", "manager"));
      const bEvents = (await b.getEvents(0)).events;
      expect(bEvents.map((event) => event.type)).toEqual(["session_opened"]);
      const aAfter = await a.getEvents(before.lastSeq);
      expect(aAfter.events).toEqual([]);
    });

    it("o PIN de um restaurante não entra no outro", async () => {
      const { a, b } = await setup();
      expect(unwrap(await b.verifyStaffPin("707070")).id).toBe("dono-b");
      expect(errorOf(await a.verifyStaffPin("707070"))).toBe("wrong_pin");
      expect(errorOf(await b.verifyStaffPin("2222"))).toBe("wrong_pin");
      expect(await b.getStaffMember("staff-demo-waiter")).toBeNull();
      expect(await a.getStaffMember("dono-b")).toBeNull();
      expect(errorOf(await b.setStaffActive("staff-demo-waiter", false, { role: "manager", staffId: "dono-b" }))).toBe(
        "not_found",
      );
    });

    it("apagar um restaurante leva tudo dele e não mexe no outro", async () => {
      const { world, a, b, session } = await setup();
      const [tableB] = await b.listTables();
      unwrap(await b.openSession(tableB.id, "4321", "manager"));
      await world.registry.remove("rest-b");
      expect(await world.registry.findBySlug("cantina-b")).toBeNull();
      expect(await world.registry.listByOwner("user-b")).toEqual([]);
      // A continua inteira.
      expect((await a.listOpenSessions()).map((entry) => entry.session.id)).toEqual([session.id]);
      expect((await a.getMenu()).items.length).toBeGreaterThan(0);
      expect(unwrap(await a.verifyStaffPin("2222")).id).toBe("staff-demo-waiter");
    });

    it("apaga nomes, observações e recados só das mesas fechadas antes do prazo", async () => {
      const { world, a, b, session, tab, item } = await setup();
      // Mesa de A com observação e recado, fechada; mesa de B continua aberta.
      unwrap(await a.createCall({ sessionId: session.id, reason: "other", message: "sem glúten?" }, "customer"));
      const second = unwrap(await a.createTab({ sessionId: session.id, customerName: "Rui", peopleCount: 1 }, "waiter"));
      const noted = unwrap(
        await a.placeOrder({ tabId: second.id, lines: [{ menuItemId: "cafe", quantity: 1, note: "sem açúcar" }] }, "waiter"),
      );
      for (const id of [tab.id, second.id]) unwrap(await a.setTabStatus(id, "paid", "waiter"));
      unwrap(await a.setItemStatus(item.id, "canceled", "waiter"));
      unwrap(await a.setItemStatus(noted.items[0].id, "canceled", "waiter"));
      unwrap(await a.closeSession(session.id, "waiter"));
      const [tableB] = await b.listTables();
      const openB = unwrap(await b.openSession(tableB.id, "4321", "manager"));
      unwrap(await b.createTab({ sessionId: openB.id, customerName: "Zé", peopleCount: 1 }, "manager"));

      // Prazo antes do fechamento: nada muda.
      expect(await world.registry.anonymizeClosedBefore("2000-01-01T00:00:00.000Z")).toBe(0);
      const history = async () => unwrap(await a.listSessionsSince("2000-01-01T00:00:00.000Z", "manager"));
      expect((await history())[0].tabs.map((entry) => entry.customerName)).toEqual(["Ana", "Rui"]);

      // Prazo depois do fechamento: nomes viram "Cliente", observação e recado somem, valores ficam.
      expect(await world.registry.anonymizeClosedBefore("2999-01-01T00:00:00.000Z")).toBe(2);
      const [closed] = await history();
      expect(closed.tabs.map((entry) => entry.customerName)).toEqual(["Cliente", "Cliente"]);
      expect(closed.items.every((entry) => entry.note === undefined)).toBe(true);
      expect(closed.calls.every((entry) => entry.message === undefined)).toBe(true);
      expect(closed.items.map((entry) => entry.unitPriceCents).every((cents) => cents > 0)).toBe(true);
      // Rodar de novo não muda nada; a mesa aberta de B fica como está.
      expect(await world.registry.anonymizeClosedBefore("2999-01-01T00:00:00.000Z")).toBe(0);
      expect((await b.listOpenSessions())[0].tabs.map((entry) => entry.customerName)).toEqual(["Zé"]);
    });

    it("mudar a configuração de um não muda a do outro", async () => {
      const { a, b } = await setup();
      unwrap(await b.updateRestaurant({ serviceFeePercent: 12 }, "manager"));
      expect((await b.getRestaurant()).serviceFeePercent).toBe(12);
      expect((await a.getRestaurant()).serviceFeePercent).toBe(10);
    });
  });
};
