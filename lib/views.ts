import type { MapSpot, Order, OrderItem, Restaurant, Tab, Table, TableSession, WaiterCall } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

export type CustomerTab = Pick<Tab, "id" | "customerName" | "peopleCount" | "status" | "approved"> & {
  mine: boolean;
};

/** O que o celular do cliente recebe: os nomes das comandas da mesa e só os próprios pedidos. */
export type CustomerView = {
  session: Pick<TableSession, "id" | "status" | "tableId">;
  table: Table;
  restaurant: Pick<Restaurant, "name" | "serviceFeePercent" | "couvertCents">;
  tabs: CustomerTab[];
  orders: Order[];
  /** Itens das próprias comandas e itens de outras comandas divididos com elas. */
  items: OrderItem[];
  calls: WaiterCall[];
  /** Planta do salão, para o cliente achar a mesa, o banheiro e o caixa. */
  mapSpots: MapSpot[];
};

export const customerView = (
  snapshot: SessionSnapshot,
  restaurant: Restaurant,
  tabIds: string[],
  mapSpots: MapSpot[] = [],
): CustomerView => {
  const mine = new Set(tabIds);
  const orderTab = new Map(snapshot.orders.map((order) => [order.id, order.tabId]));
  return {
    session: {
      id: snapshot.session.id,
      status: snapshot.session.status,
      tableId: snapshot.session.tableId,
    },
    table: snapshot.table,
    restaurant: {
      name: restaurant.name,
      serviceFeePercent: restaurant.serviceFeePercent,
      couvertCents: restaurant.couvertCents,
    },
    tabs: snapshot.tabs.map(({ id, customerName, peopleCount, status, approved }) => ({
      id,
      customerName,
      peopleCount,
      status,
      approved,
      mine: mine.has(id),
    })),
    orders: snapshot.orders.filter((order) => mine.has(order.tabId)),
    items: snapshot.items.filter(
      (item) =>
        mine.has(orderTab.get(item.orderId) ?? "") || item.shares.some((share) => mine.has(share.tabId)),
    ),
    calls: snapshot.calls.filter((call) => call.tabId !== undefined && mine.has(call.tabId)),
    mapSpots,
  };
};

/** Comanda que fez o pedido de um item. */
export const tabOfItem = (snapshot: Pick<SessionSnapshot, "orders">, item: Pick<OrderItem, "orderId">) =>
  snapshot.orders.find((order) => order.id === item.orderId)?.tabId;
