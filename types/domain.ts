/** Valor em centavos inteiros. Nunca use float para dinheiro. */
export type Cents = number;

/** Data e hora em ISO 8601 (UTC). */
export type IsoDateTime = string;

export type Station = "kitchen" | "bar";

export type Role = "customer" | "kitchen" | "waiter" | "manager";

export type Restaurant = {
  id: string;
  name: string;
  serviceFeePercent: number;
  couvertCents: Cents;
  /** O primeiro pedido de cada comanda espera a confirmação do garçom. */
  requireFirstOrderApproval: boolean;
};

export type Table = {
  id: string;
  restaurantId: string;
  label: string;
  seats: number;
};

export type MapSpotKind = "table" | "restroom" | "cashier" | "kitchen" | "bar" | "entrance";

/** Retângulo no mapa do salão, em unidades de uma grade de 100 × 100. */
export type MapSpot = {
  id: string;
  restaurantId: string;
  kind: MapSpotKind;
  label: string;
  /** Mesa ligada ao ponto, quando `kind` é `table`. */
  tableId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MenuCategory = {
  id: string;
  restaurantId: string;
  name: string;
  position: number;
};

export type MenuItem = {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  priceCents: Cents;
  station: Station;
  available: boolean;
};

export type TableSessionStatus = "open" | "closed";

export type TableSession = {
  id: string;
  restaurantId: string;
  tableId: string;
  status: TableSessionStatus;
  openedAt: IsoDateTime;
  closedAt?: IsoDateTime;
};

export type TabStatus = "open" | "bill_requested" | "paid" | "canceled";

/** Comanda: a conta de uma pessoa (ou de um casal) dentro da sessão da mesa. */
export type Tab = {
  id: string;
  sessionId: string;
  customerName: string;
  /** Pessoas na comanda, usado no couvert. */
  peopleCount: number;
  status: TabStatus;
  /** O garçom já confirmou o primeiro pedido desta comanda. */
  approved: boolean;
  createdAt: IsoDateTime;
};

/** Uma rodada de itens enviada de uma vez por uma comanda. O status é derivado dos itens. */
export type Order = {
  id: string;
  sessionId: string;
  tabId: string;
  createdAt: IsoDateTime;
};

export type ItemStatus =
  | "awaiting_approval"
  | "sent"
  | "preparing"
  | "ready"
  | "picked_up"
  | "delivered"
  | "canceled";

/** Parte de um item que cabe a uma comanda. Sem divisão, há uma só, da comanda do pedido. */
export type ItemShare = {
  tabId: string;
  parts: number;
};

export type OrderItem = {
  id: string;
  orderId: string;
  menuItemId: string;
  /** Nome e preço no momento do pedido: mudar o cardápio não muda a conta. */
  nameSnapshot: string;
  unitPriceCents: Cents;
  quantity: number;
  note?: string;
  station: Station;
  status: ItemStatus;
  shares: ItemShare[];
  updatedAt: IsoDateTime;
  /** Quando o item entrou em cada estado (o último vale, se voltou atrás). Base dos tempos médios. */
  timeline: Partial<Record<ItemStatus, IsoDateTime>>;
};

export type CallReason = "question" | "bill" | "other";

export type CallStatus = "open" | "acknowledged" | "resolved";

export type WaiterCall = {
  id: string;
  sessionId: string;
  tabId?: string;
  reason: CallReason;
  message?: string;
  status: CallStatus;
  createdAt: IsoDateTime;
};
