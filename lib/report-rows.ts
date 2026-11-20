import { computeTabBill } from "@/lib/billing";
import { ITEM_STATUS_LABEL, STATION_LABEL, TAB_STATUS_LABEL } from "@/lib/labels";
import type { Cents, Restaurant } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

/** Uma linha por item pedido (inclusive cancelados, marcados como tal). */
export type ItemRow = {
  orderedAt: string;
  table: string;
  tab: string;
  item: string;
  station: string;
  quantity: number;
  unitPriceCents: Cents;
  totalCents: Cents;
  status: string;
};

/** Uma linha por comanda, com a conta (itens, taxa, couvert e total). */
export type TabRow = {
  openedAt: string;
  table: string;
  tab: string;
  people: number;
  status: string;
  itemsCents: Cents;
  serviceFeeCents: Cents;
  couvertCents: Cents;
  totalCents: Cents;
};

/** Linhas para a planilha, a partir das mesas do período (mais antigas primeiro). */
export const reportRows = (
  sessions: SessionSnapshot[],
  restaurant: Pick<Restaurant, "serviceFeePercent" | "couvertCents">,
): { items: ItemRow[]; tabs: TabRow[] } => {
  const items: ItemRow[] = [];
  const tabs: TabRow[] = [];
  for (const { session, table, tabs: sessionTabs, orders, items: sessionItems } of sessions) {
    const orderOf = new Map(orders.map((order) => [order.id, order]));
    const tabName = new Map(sessionTabs.map((tab) => [tab.id, tab.customerName]));
    for (const item of sessionItems) {
      const order = orderOf.get(item.orderId);
      items.push({
        orderedAt: order?.createdAt ?? session.openedAt,
        table: table.label,
        tab: (order && tabName.get(order.tabId)) ?? "",
        item: item.nameSnapshot,
        station: STATION_LABEL[item.station],
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalCents: item.status === "canceled" ? 0 : item.unitPriceCents * item.quantity,
        status: ITEM_STATUS_LABEL[item.status],
      });
    }
    for (const tab of sessionTabs) {
      const bill = computeTabBill(tab, sessionItems, restaurant);
      tabs.push({
        openedAt: session.openedAt,
        table: table.label,
        tab: tab.customerName,
        people: tab.peopleCount,
        status: TAB_STATUS_LABEL[tab.status],
        itemsCents: bill.subtotalCents,
        serviceFeeCents: bill.serviceFeeCents,
        couvertCents: bill.couvertCents,
        totalCents: bill.totalCents,
      });
    }
  }
  items.sort((a, b) => a.orderedAt.localeCompare(b.orderedAt));
  tabs.sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  return { items, tabs };
};
