import { describe, expect, it } from "vitest";
import { RESTAURANT, TABLES } from "@/lib/seed-data";
import { customerView, tabOfItem } from "@/lib/views";
import type { OrderItem } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

const item = (id: string, orderId: string, tabIds: string[]): OrderItem => ({
  id,
  orderId,
  menuItemId: id,
  nameSnapshot: id,
  unitPriceCents: 1000,
  quantity: 1,
  station: "kitchen",
  status: "sent",
  shares: tabIds.map((tabId) => ({ tabId, parts: 1 })),
  updatedAt: "2026-11-18T20:00:00.000Z",
});

const tab = (id: string, customerName: string) => ({
  id,
  sessionId: "s1",
  customerName,
  peopleCount: 1,
  status: "open" as const,
  approved: true,
  createdAt: "2026-11-18T20:00:00.000Z",
});

const snapshot: SessionSnapshot = {
  session: { id: "s1", restaurantId: "demo", tableId: "mesa-3", status: "open", openedAt: "2026-11-18T20:00:00.000Z" },
  table: TABLES[2],
  tabs: [tab("ana", "Ana"), tab("bia", "Bia"), tab("caio", "Caio")],
  orders: [
    { id: "o-ana", sessionId: "s1", tabId: "ana", createdAt: "2026-11-18T20:00:00.000Z" },
    { id: "o-bia", sessionId: "s1", tabId: "bia", createdAt: "2026-11-18T20:00:00.000Z" },
  ],
  items: [
    item("risoto", "o-ana", ["ana"]),
    item("vinho", "o-bia", ["bia", "ana"]),
    item("lasanha", "o-bia", ["bia"]),
  ],
  calls: [
    { id: "c-ana", sessionId: "s1", tabId: "ana", reason: "bill", status: "open", createdAt: "2026-11-18T20:00:00.000Z" },
    { id: "c-bia", sessionId: "s1", tabId: "bia", reason: "question", status: "open", createdAt: "2026-11-18T20:00:00.000Z" },
  ],
};

describe("customerView", () => {
  it("mostra os próprios itens e os divididos com a comanda", () => {
    const view = customerView(snapshot, RESTAURANT, ["ana"]);
    expect(view.items.map((entry) => entry.id)).toEqual(["risoto", "vinho"]);
    expect(view.orders.map((order) => order.id)).toEqual(["o-ana"]);
    expect(view.calls.map((call) => call.id)).toEqual(["c-ana"]);
  });

  it("lista as comandas da mesa marcando as do aparelho", () => {
    const view = customerView(snapshot, RESTAURANT, ["caio"]);
    expect(view.tabs.map((entry) => entry.mine)).toEqual([false, false, true]);
    expect(view.items).toEqual([]);
  });

  it("não expõe dados internos do restaurante", () => {
    const view = customerView(snapshot, RESTAURANT, ["ana"]);
    expect(Object.keys(view.restaurant).sort()).toEqual(["couvertCents", "name", "serviceFeePercent"]);
  });
});

describe("tabOfItem", () => {
  it("acha a comanda que pediu o item", () => {
    expect(tabOfItem(snapshot, snapshot.items[1])).toBe("bia");
    expect(tabOfItem(snapshot, { orderId: "nada" })).toBeUndefined();
  });
});
