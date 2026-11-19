import { describe, expect, it } from "vitest";
import { computeDayReport, startOfLocalDay } from "@/lib/metrics";
import { TABLES } from "@/lib/seed-data";
import type { ItemStatus, OrderItem, Tab } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

const at = (minute: number) => `2026-11-18T20:${String(minute).padStart(2, "0")}:00.000Z`;

const tab = (id: string, status: Tab["status"], peopleCount = 1): Tab => ({
  id,
  sessionId: "s",
  customerName: id,
  peopleCount,
  status,
  approved: true,
  createdAt: at(0),
});

const item = (
  name: string,
  tabId: string,
  price: number,
  quantity: number,
  status: ItemStatus,
  timeline: OrderItem["timeline"] = {},
): OrderItem => ({
  id: `${name}-${tabId}`,
  orderId: `o-${tabId}`,
  menuItemId: name,
  nameSnapshot: name,
  unitPriceCents: price,
  quantity,
  station: "kitchen",
  status,
  shares: [{ tabId, parts: 1 }],
  updatedAt: at(0),
  timeline,
});

const session = (index: number, status: "open" | "closed", tabs: Tab[], items: OrderItem[]): SessionSnapshot => ({
  session: { id: `s${index}`, restaurantId: "demo", tableId: TABLES[index].id, status, openedAt: at(0) },
  table: TABLES[index],
  tabs,
  orders: tabs.map((entry) => ({ id: `o-${entry.id}`, sessionId: `s${index}`, tabId: entry.id, createdAt: at(0) })),
  items,
  calls: [],
});

const config = { serviceFeePercent: 10, couvertCents: 0 };

describe("startOfLocalDay", () => {
  it("volta para a meia-noite local do mesmo dia", () => {
    const start = new Date(startOfLocalDay(new Date(2026, 10, 18, 22, 45)));
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes()]).toEqual([
      2026, 10, 18, 0, 0,
    ]);
  });
});

describe("computeDayReport", () => {
  const sessions = [
    // Mesa fechada: o casal pagou 2 chopes e um risoto; o risoto levou 12 min de preparo.
    session(0, "closed", [tab("casal", "paid", 2)], [
      item("Chope", "casal", 1300, 2, "delivered", { sent: at(0), delivered: at(6) }),
      item("Risoto", "casal", 6400, 1, "delivered", { sent: at(0), preparing: at(2), ready: at(14), delivered: at(16) }),
    ]),
    // Mesa aberta: Lia pagou um chope; Zé ainda está comendo e cancelou um item.
    session(1, "open", [tab("lia", "paid"), tab("ze", "open")], [
      item("Chope", "lia", 1300, 1, "delivered"),
      item("Lasanha", "ze", 6200, 1, "preparing", { sent: at(5), preparing: at(8) }),
      item("Tiramisù", "ze", 2600, 1, "canceled"),
    ]),
  ];

  it("soma o faturamento das comandas pagas, com a taxa", () => {
    const report = computeDayReport(sessions, config);
    // casal: (2600 + 6400) × 1,1 = 9900; Lia: 1300 × 1,1 = 1430.
    expect(report.revenueCents).toBe(11330);
    expect(report.paidTabs).toBe(2);
    expect(report.peopleServed).toBe(3);
    expect(report.averagePerPersonCents).toBe(3777);
  });

  it("conta mesas, itens vendidos e cancelados", () => {
    const report = computeDayReport(sessions, config);
    expect(report).toMatchObject({ openTables: 1, closedTables: 1, itemsSold: 5, canceledItems: 1 });
  });

  it("calcula os tempos médios só com os itens que têm as duas pontas", () => {
    const report = computeDayReport(sessions, config);
    expect(report.averagePrepMinutes).toBe(12);
    // Chope 6 min e risoto 16 min até a mesa.
    expect(report.averageServeMinutes).toBe(11);
  });

  it("lista os mais pedidos por quantidade, sem os cancelados", () => {
    expect(computeDayReport(sessions, config).topItems).toEqual([
      { name: "Chope", quantity: 3 },
      { name: "Lasanha", quantity: 1 },
      { name: "Risoto", quantity: 1 },
    ]);
  });

  it("devolve zeros e tempos vazios num dia sem movimento", () => {
    expect(computeDayReport([], config)).toMatchObject({
      revenueCents: 0,
      averagePerPersonCents: 0,
      averagePrepMinutes: null,
      averageServeMinutes: null,
      topItems: [],
    });
  });
});
