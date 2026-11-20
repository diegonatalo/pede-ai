import { describe, expect, it } from "vitest";
import { reportRows } from "@/lib/report-rows";
import { createMemoryStore } from "@/lib/store/memory";
import type { Result } from "@/types/store";

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe("reportRows", () => {
  it("uma linha por item (cancelado sem valor) e uma por comanda, com a conta", async () => {
    let tick = 0;
    const store = createMemoryStore({ now: () => new Date(Date.UTC(2026, 10, 20, 22, tick++)) });
    const session = unwrap(await store.openSession("mesa-2", "1234", "waiter"));
    const ana = unwrap(await store.createTab({ sessionId: session.id, customerName: "Ana", peopleCount: 2 }, "waiter"));
    const { items } = unwrap(
      await store.placeOrder(
        { tabId: ana.id, lines: [{ menuItemId: "chope", quantity: 2 }, { menuItemId: "cafe", quantity: 1 }] },
        "waiter",
      ),
    );
    unwrap(await store.setItemStatus(items[1].id, "canceled", "waiter"));
    const [snapshot] = unwrap(await store.listSessionsSince("2000-01-01T00:00:00.000Z", "manager"));
    const rows = reportRows([snapshot], { serviceFeePercent: 10, couvertCents: 0 });

    expect(rows.items.map(({ item, quantity, totalCents, status, table, tab, station }) => ({ item, quantity, totalCents, status, table, tab, station }))).toEqual([
      { item: "Chope", quantity: 2, totalCents: 2600, status: "Na fila", table: "Mesa 2", tab: "Ana", station: "Bar" },
      { item: "Café espresso", quantity: 1, totalCents: 0, status: "Cancelado", table: "Mesa 2", tab: "Ana", station: "Bar" },
    ]);
    expect(rows.tabs).toEqual([
      {
        openedAt: session.openedAt,
        table: "Mesa 2",
        tab: "Ana",
        people: 2,
        status: "Aberta",
        itemsCents: 2600,
        serviceFeeCents: 260,
        couvertCents: 0,
        totalCents: 2860,
      },
    ]);
  });
});
