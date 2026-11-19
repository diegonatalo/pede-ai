import { describe, expect, it } from "vitest";
import { RESTAURANT, TABLES } from "@/lib/seed-data";
import {
  activeCalls,
  minutesSince,
  pendingApprovals,
  pickupQueue,
  tableBoard,
  waiterAttention,
} from "@/lib/selectors";
import type { ItemStatus, OrderItem, Tab, WaiterCall } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

const at = (minute: number) => `2026-11-18T20:${String(minute).padStart(2, "0")}:00.000Z`;

const tab = (id: string, approved: boolean, status: Tab["status"] = "open"): Tab => ({
  id,
  sessionId: `s-${id}`,
  customerName: id.toUpperCase(),
  peopleCount: 1,
  status,
  approved,
  createdAt: at(0),
});

const item = (id: string, tabId: string, status: ItemStatus, minute: number, price = 1000): OrderItem => ({
  id,
  orderId: `o-${tabId}`,
  menuItemId: id,
  nameSnapshot: id,
  unitPriceCents: price,
  quantity: 1,
  station: "kitchen",
  status,
  shares: [{ tabId, parts: 1 }],
  updatedAt: at(minute),
});

const call = (id: string, tabId: string, status: WaiterCall["status"], minute: number): WaiterCall => ({
  id,
  sessionId: "s",
  tabId,
  reason: "question",
  status,
  createdAt: at(minute),
});

const session = (tableIndex: number, tabs: Tab[], items: OrderItem[], calls: WaiterCall[] = []): SessionSnapshot => ({
  session: {
    id: `sessao-${tableIndex}`,
    restaurantId: "demo",
    tableId: TABLES[tableIndex].id,
    status: "open",
    openedAt: at(0),
  },
  table: TABLES[tableIndex],
  tabs,
  orders: tabs.map((entry) => ({ id: `o-${entry.id}`, sessionId: `sessao-${tableIndex}`, tabId: entry.id, createdAt: at(0) })),
  items,
  calls,
});

// Mesa 1: Ana esperando confirmação, Bia já confirmada com um item pronto.
// Mesa 3: Caio com um item a caminho, um chamado aberto e a conta pedida.
const sessions = [
  session(0, [tab("ana", false), tab("bia", true)], [
    item("chope", "ana", "awaiting_approval", 5),
    item("risoto", "bia", "ready", 3),
    item("agua", "bia", "delivered", 1),
  ]),
  session(2, [tab("caio", true, "bill_requested")], [item("vinho", "caio", "picked_up", 2, 12900)], [
    call("c1", "caio", "open", 4),
    call("c2", "caio", "resolved", 1),
  ]),
];

describe("pendingApprovals", () => {
  it("lista comandas não confirmadas que têm itens esperando", () => {
    const requests = pendingApprovals(sessions);
    expect(requests.map((request) => request.tab.id)).toEqual(["ana"]);
    expect(requests[0].items.map((entry) => entry.id)).toEqual(["chope"]);
  });

  it("ignora comanda não confirmada sem pedido", () => {
    expect(pendingApprovals([session(1, [tab("zé", false)], [])])).toEqual([]);
  });
});

describe("pickupQueue", () => {
  it("traz prontos e a caminho, do mais antigo para o mais novo", () => {
    const queue = pickupQueue(sessions);
    expect(queue.map((entry) => [entry.item.id, entry.table.label, entry.tabName])).toEqual([
      ["vinho", "Mesa 3", "CAIO"],
      ["risoto", "Mesa 1", "BIA"],
    ]);
  });
});

describe("activeCalls", () => {
  it("traz só os chamados não resolvidos, com a mesa e a comanda", () => {
    expect(activeCalls(sessions).map((entry) => [entry.call.id, entry.table.label, entry.tabName])).toEqual([
      ["c1", "Mesa 3", "CAIO"],
    ]);
  });
});

describe("waiterAttention", () => {
  it("soma confirmações, itens prontos e chamados abertos", () => {
    // ana (confirmação) + risoto (pronto) + c1 (chamado); o vinho já está a caminho.
    expect(waiterAttention(sessions)).toBe(3);
    expect(waiterAttention([])).toBe(0);
  });
});

describe("tableBoard", () => {
  it("resume cada mesa do salão", () => {
    const board = tableBoard(TABLES, sessions, RESTAURANT, { "sessao-0": "1234" });
    expect(board).toHaveLength(TABLES.length);

    const first = board[0];
    expect(first).toMatchObject({ joinCode: "1234", needsApproval: true, billRequested: false, canClose: false });
    // Ana: chope 1000 + 10% = 1100. Bia: risoto 1000 + água 1000 + 10% = 2200.
    expect(first.bills.map((bill) => bill.totalCents)).toEqual([1100, 2200]);
    expect(first.totalCents).toBe(3300);

    expect(board[1].session).toBeUndefined();
    expect(board[1]).toMatchObject({ totalCents: 0, canClose: false });
    expect(board[2]).toMatchObject({ billRequested: true, needsApproval: false, totalCents: 14190 });
  });

  it("deixa fechar quando todas as comandas estão pagas", () => {
    const paid = session(4, [tab("lia", true, "paid")], [item("cafe", "lia", "delivered", 1)]);
    expect(tableBoard(TABLES, [paid], RESTAURANT, {})[4].canClose).toBe(true);
  });
});

describe("minutesSince", () => {
  it("conta minutos inteiros e não fica negativo", () => {
    const now = Date.parse(at(10));
    expect(minutesSince(at(3), now)).toBe(7);
    expect(minutesSince(at(10), now)).toBe(0);
    expect(minutesSince(at(12), now)).toBe(0);
  });
});
