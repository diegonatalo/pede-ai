import { describe, expect, it } from "vitest";
import type { StaffIdentity } from "@/lib/api/identity";
import type { ApiResult } from "@/lib/api/result";
import {
  approveTab,
  closeTable,
  createTeamMember,
  createStaffTab,
  getManagerReport,
  getStaffFeed,
  getStaffOverview,
  getTeam,
  openTable,
  placeStaffOrder,
  resetTeamPin,
  resolveStaffActor,
  setAvailability,
  setStaffCallStatus,
  setStaffItemShares,
  setStaffItemStatus,
  setStaffTabStatus,
  setTeamActive,
  staffLogin,
  staffLogout,
  STAFF_LOCKED_MESSAGE,
  updateSettings,
} from "@/lib/api/staff";
import { SAMPLE_PINS } from "@/lib/seed-data";
import { createMemoryRateLimiter, createMemoryStore } from "@/lib/store/memory";
import type { OrderItem, Tab, TableSession } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

const NOW = Date.parse("2026-11-18T20:00:00.000Z");
const errorOf = (result: ApiResult) => (result.body as { error?: string }).error ?? "ok";

describe("login da equipe", () => {
  const seatsOf = (result: ApiResult) => (result.staff as StaffIdentity).seats;

  it("entra com o PIN pessoal e guarda quem entrou em cada tela do restaurante", async () => {
    const store = createMemoryStore();
    const waiter = await staffLogin(store, null, { role: "waiter", pin: SAMPLE_PINS.waiter }, NOW, "demo");
    expect(waiter.body).toEqual({ roles: ["waiter"], name: "Garçom da demo" });
    expect(seatsOf(waiter)).toEqual({ "demo:waiter": { id: "staff-demo-waiter", name: "Garçom da demo" } });
    const both = await staffLogin(store, waiter.staff as StaffIdentity, { role: "kitchen", pin: SAMPLE_PINS.kitchen }, NOW, "demo");
    expect(Object.keys(seatsOf(both)).sort()).toEqual(["demo:kitchen", "demo:waiter"]);
  });

  it("deixa o gerente usar a tela do garçom, mas não o garçom usar a do gerente", async () => {
    const store = createMemoryStore();
    const manager = await staffLogin(store, null, { role: "waiter", pin: SAMPLE_PINS.manager }, NOW, "demo");
    expect(seatsOf(manager)["demo:waiter"]).toEqual({ id: "staff-demo-manager", name: "Gerente da demo" });
    expect(errorOf(await staffLogin(store, null, { role: "manager", pin: SAMPLE_PINS.waiter }, NOW, "demo"))).toBe(
      "wrong_screen",
    );
  });

  it("conta os PINs errados de quem tenta e barra quem passou do limite, mesmo com o PIN certo", async () => {
    const store = createMemoryStore();
    const limiter = createMemoryRateLimiter({ failures: 2, windowMs: 60_000 });
    const guard = {
      isBlocked: () => limiter.isBlocked("staff-pin:x", NOW),
      recordFailure: () => limiter.recordFailure("staff-pin:x", NOW),
    };
    const login = (pin: string) => staffLogin(store, null, { role: "waiter", pin }, NOW, "demo", guard);
    // PIN certo não conta como erro.
    expect(errorOf(await login(SAMPLE_PINS.waiter))).toBe("ok");
    expect(errorOf(await login("9999"))).toBe("wrong_pin");
    expect(errorOf(await login("9998"))).toBe("wrong_pin");
    const blocked = await login(SAMPLE_PINS.waiter);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "locked", message: STAFF_LOCKED_MESSAGE });
    // Barrado pelo endereço, nem chega a gastar as tentativas do restaurante: outra pessoa ainda entra.
    expect(errorOf(await staffLogin(store, null, { role: "waiter", pin: SAMPLE_PINS.waiter }, NOW, "demo"))).toBe("ok");
  });

  it("recusa PIN errado e papel de cliente", async () => {
    const store = createMemoryStore();
    expect(errorOf(await staffLogin(store, null, { role: "waiter", pin: "9999" }, NOW, "demo"))).toBe("wrong_pin");
    expect(errorOf(await staffLogin(store, null, { role: "customer", pin: "2222" }, NOW, "demo"))).toBe("invalid_input");
  });

  it("sai de uma tela ou de todas as do restaurante, sem mexer nas de outro", () => {
    const identity: StaffIdentity = {
      seats: {
        "demo:waiter": { id: "a", name: "Ana" },
        "demo:kitchen": { id: "b", name: "Bia" },
        "outro:manager": { id: "c", name: "Caio" },
      },
      exp: NOW + 1000,
    };
    expect(staffLogout(identity, { role: "kitchen" }, "demo").staff).toEqual({
      seats: { "demo:waiter": { id: "a", name: "Ana" }, "outro:manager": { id: "c", name: "Caio" } },
      exp: NOW + 1000,
    });
    expect(staffLogout(identity, {}, "demo").staff).toEqual({ seats: { "outro:manager": { id: "c", name: "Caio" } }, exp: NOW + 1000 });
    expect(staffLogout({ seats: { "demo:waiter": { id: "a", name: "Ana" } }, exp: NOW + 1000 }, {}, "demo").staff).toBeNull();
  });

  it("confere a tela pedida contra o cookie, só no restaurante dela", () => {
    const identity: StaffIdentity = { seats: { "demo:kitchen": { id: "c1", name: "Caio" } }, exp: NOW + 1000 };
    expect(resolveStaffActor(identity, "kitchen", "demo")).toEqual({ role: "kitchen", staffId: "c1", name: "Caio" });
    expect(errorOf(resolveStaffActor(identity, "kitchen", "outro") as ApiResult)).toBe("not_logged_in");
    expect(errorOf(resolveStaffActor(identity, "manager", "demo") as ApiResult)).toBe("not_logged_in");
    expect(errorOf(resolveStaffActor(null, "kitchen", "demo") as ApiResult)).toBe("not_logged_in");
    expect(errorOf(resolveStaffActor(identity, "customer", "demo") as ApiResult)).toBe("invalid_input");
  });
});

describe("equipe", () => {
  const manager = { role: "manager" as const, staffId: "staff-demo-manager", name: "Gerente da demo" };

  it("o gerente cadastra, troca o PIN e desativa; o garçom não", async () => {
    const store = createMemoryStore();
    expect(errorOf(await getTeam(store, "waiter"))).toBe("forbidden");
    const created = await createTeamMember(store, manager, { name: "Bruno", role: "waiter" });
    const { member, pin } = created.body as { member: { id: string }; pin: string };
    expect(pin).toMatch(/^\d{6}$/);
    expect(errorOf(await createTeamMember(store, manager, { name: "Bruno" }))).toBe("invalid_input");

    const login = await staffLogin(store, null, { role: "waiter", pin }, NOW, "demo");
    expect((login.body as { name: string }).name).toBe("Bruno");

    const reset = await resetTeamPin(store, manager, member.id);
    expect((reset.body as { pin: string }).pin).not.toBe(pin);
    expect(errorOf(await setTeamActive(store, manager, member.id, { active: "não" }))).toBe("invalid_input");
    expect((await setTeamActive(store, manager, member.id, { active: false })).status).toBe(200);
    expect(((await getTeam(store, manager)).body as { active: boolean }[]).filter((entry) => !entry.active)).toHaveLength(1);
  });

  it("mostra no painel quem está na tela", async () => {
    const store = createMemoryStore();
    const overview = await getStaffOverview(store, { role: "waiter", staffId: "s1", name: "Bruno" });
    expect((overview.body as { me: unknown }).me).toEqual({ name: "Bruno", role: "waiter", staffId: "s1" });
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

  it("filtra o relatório pelo período e devolve as linhas das planilhas", async () => {
    let minute = 0;
    // Uma mesa aberta em 10/11 e outra em 20/11.
    const times = [Date.UTC(2026, 10, 10, 22), Date.UTC(2026, 10, 20, 22)];
    let current = times[0];
    const store = createMemoryStore({ now: () => new Date(current + minute++ * 60_000) });
    for (const [index, tableId] of ["mesa-1", "mesa-2"].entries()) {
      current = times[index];
      const { session } = (await openTable(store, "waiter", { tableId })).body as { session: TableSession };
      const tab = (await createStaffTab(store, "waiter", { sessionId: session.id, customerName: `C${index}`, peopleCount: 1 }))
        .body as Tab;
      await placeStaffOrder(store, "waiter", { tabId: tab.id, lines: [{ menuItemId: "chope", quantity: 1 }] });
    }
    const november20 = await getManagerReport(store, "manager", "2026-11-20T00:00:00.000Z", "2026-11-21T00:00:00.000Z");
    const body = november20.body as { report: { openTables: number }; rows: { items: { tab: string }[]; tabs: unknown[] } };
    expect(body.report.openTables).toBe(1);
    expect(body.rows.items.map((row) => row.tab)).toEqual(["C1"]);
    expect(body.rows.tabs).toHaveLength(1);
    // Período sem mesas, invertido, inválido ou longo demais.
    const empty = await getManagerReport(store, "manager", "2026-11-11T00:00:00.000Z", "2026-11-12T00:00:00.000Z");
    expect((empty.body as { rows: { items: unknown[] } }).rows.items).toEqual([]);
    expect(errorOf(await getManagerReport(store, "manager", "2026-11-21T00:00:00.000Z", "2026-11-20T00:00:00.000Z"))).toBe(
      "invalid_input",
    );
    expect(errorOf(await getManagerReport(store, "manager", "ontem"))).toBe("invalid_input");
    expect(errorOf(await getManagerReport(store, "manager", "2020-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"))).toBe(
      "invalid_input",
    );
  });

  it("avisa quando algo mudou em qualquer mesa", async () => {
    const store = createMemoryStore();
    const start = (await getStaffFeed(store, 0)).body as { lastSeq: number; changed: boolean };
    expect(start).toEqual({ lastSeq: 0, changed: false });
    await openTable(store, "waiter", { tableId: "mesa-1" });
    expect((await getStaffFeed(store, 0)).body).toEqual({ lastSeq: 1, changed: true });
  });
});
