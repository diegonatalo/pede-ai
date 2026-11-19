import { describe, expect, it } from "vitest";
import { DEMO_PINS } from "@/lib/api/config";
import type { StaffIdentity } from "@/lib/api/identity";
import type { ApiResult } from "@/lib/api/result";
import {
  approveTab,
  closeTable,
  createStaffTab,
  getManagerReport,
  getStaffFeed,
  getStaffOverview,
  openTable,
  placeStaffOrder,
  resolveStaffRole,
  setAvailability,
  setStaffCallStatus,
  setStaffItemShares,
  setStaffItemStatus,
  setStaffTabStatus,
  staffLogin,
  staffLogout,
  updateSettings,
} from "@/lib/api/staff";
import { createMemoryStore } from "@/lib/store/memory";
import type { OrderItem, Tab, TableSession } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

const NOW = Date.parse("2026-11-18T20:00:00.000Z");
const errorOf = (result: ApiResult) => (result.body as { error?: string }).error ?? "ok";

describe("login da equipe", () => {
  it("entra com o PIN certo e acumula papéis no mesmo navegador", () => {
    const waiter = staffLogin(null, { role: "waiter", pin: DEMO_PINS.waiter }, DEMO_PINS, NOW);
    expect(waiter.staff).toMatchObject({ roles: ["waiter"] });
    const both = staffLogin(waiter.staff as StaffIdentity, { role: "kitchen", pin: "1111" }, DEMO_PINS, NOW);
    expect(both.staff).toMatchObject({ roles: ["waiter", "kitchen"] });
  });

  it("recusa PIN errado e papel de cliente", () => {
    expect(errorOf(staffLogin(null, { role: "waiter", pin: "1111" }, DEMO_PINS, NOW))).toBe("wrong_pin");
    expect(errorOf(staffLogin(null, { role: "waiter", pin: "22222" }, DEMO_PINS, NOW))).toBe("wrong_pin");
    expect(errorOf(staffLogin(null, { role: "customer", pin: "x" }, DEMO_PINS, NOW))).toBe("invalid_input");
  });

  it("sai de um papel ou de todos", () => {
    const identity: StaffIdentity = { roles: ["waiter", "kitchen"], exp: NOW + 1000 };
    expect(staffLogout(identity, { role: "kitchen" }).staff).toMatchObject({ roles: ["waiter"] });
    expect(staffLogout(identity, {}).staff).toBeNull();
  });

  it("confere o papel pedido contra o cookie", () => {
    const identity: StaffIdentity = { roles: ["kitchen"], exp: NOW + 1000 };
    expect(resolveStaffRole(identity, "kitchen")).toBe("kitchen");
    expect(errorOf(resolveStaffRole(identity, "manager") as ApiResult)).toBe("not_logged_in");
    expect(errorOf(resolveStaffRole(null, "kitchen") as ApiResult)).toBe("not_logged_in");
    expect(errorOf(resolveStaffRole(identity, "customer") as ApiResult)).toBe("invalid_input");
  });
});

describe("mesas", () => {
  it("abre a mesa com um código novo, que a cozinha não vê", async () => {
    const store = createMemoryStore();
    const opened = await openTable(store, "waiter", { tableId: "mesa-2" });
    const { session, joinCode } = opened.body as { session: TableSession; joinCode: string };
    expect(joinCode).toMatch(/^\d{4}$/);

    const forWaiter = (await getStaffOverview(store, "waiter")).body as { joinCodes: Record<string, string> };
    expect(forWaiter.joinCodes[session.id]).toBe(joinCode);
    const forKitchen = (await getStaffOverview(store, "kitchen")).body as {
      joinCodes: Record<string, string>;
      sessions: SessionSnapshot[];
    };
    expect(forKitchen.joinCodes).toEqual({});
    expect(forKitchen.sessions).toHaveLength(1);
  });

  it("não deixa a cozinha abrir mesa", async () => {
    const store = createMemoryStore();
    expect(errorOf(await openTable(store, "kitchen", { tableId: "mesa-2" }))).toBe("forbidden");
    expect(errorOf(await openTable(store, "waiter", {}))).toBe("invalid_input");
  });
});

describe("fluxo da equipe", () => {
  it("confirma, prepara, entrega, recebe e fecha a mesa", async () => {
    const store = createMemoryStore();
    const { session } = (await openTable(store, "waiter", { tableId: "mesa-4" })).body as { session: TableSession };
    const tabResult = await store.createTab({ sessionId: session.id, customerName: "Ana", peopleCount: 1 }, "customer");
    if (!tabResult.ok) throw new Error(tabResult.error);
    const tab = tabResult.value;
    const placed = await store.placeOrder({ tabId: tab.id, lines: [{ menuItemId: "chope", quantity: 1 }] }, "customer");
    if (!placed.ok) throw new Error(placed.error);
    const [item] = placed.value.items;

    expect(errorOf(await approveTab(store, "kitchen", tab.id))).toBe("forbidden");
    expect((await approveTab(store, "waiter", tab.id)).status).toBe(200);
    for (const [role, to] of [
      ["kitchen", "preparing"],
      ["kitchen", "ready"],
      ["waiter", "picked_up"],
      ["waiter", "delivered"],
    ] as const) {
      expect((await setStaffItemStatus(store, role, item.id, { to })).status).toBe(200);
    }
    expect(errorOf(await closeTable(store, "waiter", session.id))).toBe("cannot_close");
    expect((await setStaffTabStatus(store, "waiter", tab.id, { to: "paid" })).status).toBe(200);
    expect((await closeTable(store, "waiter", session.id)).status).toBe(200);
  });

  it("abre comanda e lança pedido direto para a cozinha", async () => {
    const store = createMemoryStore();
    const { session } = (await openTable(store, "waiter", { tableId: "mesa-4" })).body as { session: TableSession };
    const tab = (await createStaffTab(store, "waiter", { sessionId: session.id, customerName: "Vó", peopleCount: 1 }))
      .body as Tab;
    const placed = await placeStaffOrder(store, "waiter", {
      tabId: tab.id,
      lines: [{ menuItemId: "nhoque", quantity: 1, note: "sem queijo" }],
    });
    const [item] = (placed.body as { items: OrderItem[] }).items;
    expect(item).toMatchObject({ status: "sent", note: "sem queijo" });

    const other = (await createStaffTab(store, "waiter", { sessionId: session.id, customerName: "Leo", peopleCount: 1 }))
      .body as Tab;
    const shares = [
      { tabId: tab.id, parts: 1 },
      { tabId: other.id, parts: 1 },
    ];
    expect((await setStaffItemShares(store, "waiter", item.id, { shares })).status).toBe(200);
  });

  it("valida o corpo dos comandos", async () => {
    const store = createMemoryStore();
    expect(errorOf(await setStaffItemStatus(store, "kitchen", "x", {}))).toBe("invalid_input");
    expect(errorOf(await setStaffCallStatus(store, "waiter", "x", { to: 1 }))).toBe("invalid_input");
    expect(errorOf(await createStaffTab(store, "waiter", { sessionId: "s" }))).toBe("invalid_input");
    expect(errorOf(await setAvailability(store, "kitchen", "chope", { available: "não" }))).toBe("invalid_input");
  });
});

describe("cardápio, configuração e feed", () => {
  it("esgota item pela cozinha e muda a taxa pelo gerente", async () => {
    const store = createMemoryStore();
    expect((await setAvailability(store, "kitchen", "chope", { available: false })).status).toBe(200);
    expect(errorOf(await updateSettings(store, "waiter", { serviceFeePercent: 12 }))).toBe("forbidden");
    expect(errorOf(await updateSettings(store, "manager", { serviceFeePercent: "12" }))).toBe("invalid_input");
    const updated = await updateSettings(store, "manager", { serviceFeePercent: 12, requireFirstOrderApproval: false });
    expect(updated.body).toMatchObject({ serviceFeePercent: 12, requireFirstOrderApproval: false });
  });

  it("monta o relatório do dia só para o gerente", async () => {
    const store = createMemoryStore();
    const { session } = (await openTable(store, "waiter", { tableId: "mesa-4" })).body as { session: TableSession };
    const tab = (await createStaffTab(store, "waiter", { sessionId: session.id, customerName: "Ana", peopleCount: 2 }))
      .body as Tab;
    await placeStaffOrder(store, "waiter", { tabId: tab.id, lines: [{ menuItemId: "chope", quantity: 2 }] });
    await setStaffTabStatus(store, "waiter", tab.id, { to: "paid" });

    const since = "2000-01-01T00:00:00.000Z";
    const result = await getManagerReport(store, "manager", since);
    expect(result.body).toMatchObject({ since, report: { revenueCents: 2860, paidTabs: 1, peopleServed: 2, itemsSold: 2 } });
    expect(errorOf(await getManagerReport(store, "waiter", since))).toBe("forbidden");
    expect(errorOf(await getManagerReport(store, "manager", null))).toBe("invalid_input");
  });

  it("avisa quando algo mudou em qualquer mesa", async () => {
    const store = createMemoryStore();
    const start = (await getStaffFeed(store, 0)).body as { lastSeq: number; changed: boolean };
    expect(start).toEqual({ lastSeq: 0, changed: false });
    await openTable(store, "waiter", { tableId: "mesa-1" });
    expect((await getStaffFeed(store, 0)).body).toEqual({ lastSeq: 1, changed: true });
  });
});
