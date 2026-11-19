import type { SharesError } from "@/lib/billing";
import type {
  CallReason,
  CallStatus,
  IsoDateTime,
  ItemShare,
  ItemStatus,
  MapSpot,
  MenuCategory,
  MenuItem,
  Order,
  OrderItem,
  Restaurant,
  Role,
  Tab,
  TabStatus,
  Table,
  TableSession,
  WaiterCall,
} from "@/types/domain";

export type StoreError =
  | "not_found"
  | "invalid_input"
  | "invalid_transition"
  | "forbidden"
  | "session_closed"
  | "tab_closed"
  | "item_unavailable"
  | "cannot_close"
  | "already_open"
  | "wrong_code"
  | "locked"
  | SharesError;

export type Result<T> = { ok: true; value: T } | { ok: false; error: StoreError };

export type EventType =
  | "session_opened"
  | "session_closed"
  | "tab_created"
  | "tab_approved"
  | "tab_status_changed"
  | "order_placed"
  | "item_status_changed"
  | "item_shares_changed"
  | "item_availability_changed"
  | "call_created"
  | "call_status_changed"
  | "restaurant_updated";

/** Registro de cada mudança. As telas consultam os eventos depois do último `seq` que viram. */
export type StoreEvent = {
  seq: number;
  type: EventType;
  at: IsoDateTime;
  actor: Role;
  sessionId?: string;
  /** Id da entidade que mudou (comanda, item, chamado...). */
  entityId: string;
};

export type Menu = { categories: MenuCategory[]; items: MenuItem[] };

/** Tudo de uma mesa aberta: o que o cliente e o garçom precisam numa só leitura. */
export type SessionSnapshot = {
  session: TableSession;
  table: Table;
  tabs: Tab[];
  orders: Order[];
  items: OrderItem[];
  calls: WaiterCall[];
};

export type OrderLineInput = { menuItemId: string; quantity: number; note?: string };

export type RestaurantSettings = Partial<
  Pick<Restaurant, "serviceFeePercent" | "couvertCents" | "requireFirstOrderApproval">
>;

/**
 * Camada de dados. Assíncrona porque o adaptador do Postgres é. Cada comando valida
 * a entrada e as permissões do papel antes de gravar, e grava um evento.
 * Quem chama (os Route Handlers) é responsável por saber qual comanda é do cliente.
 */
export type Store = {
  getRestaurant(): Promise<Restaurant>;
  updateRestaurant(settings: RestaurantSettings, actor: Role): Promise<Result<Restaurant>>;
  listTables(): Promise<Table[]>;
  listMapSpots(): Promise<MapSpot[]>;
  getMenu(): Promise<Menu>;
  setItemAvailability(menuItemId: string, available: boolean, actor: Role): Promise<Result<MenuItem>>;

  openSession(tableId: string, joinCode: string, actor: Role): Promise<Result<TableSession>>;
  /** Código da mesa, para o garçom mostrar ao cliente. */
  getJoinCode(sessionId: string, actor: Role): Promise<Result<string>>;
  /** Confere o código digitado; bloqueia a sessão por alguns minutos depois de muitos erros. */
  verifyJoinCode(sessionId: string, code: string): Promise<Result<true>>;
  getOpenSessionByTable(tableId: string): Promise<TableSession | null>;
  getSessionSnapshot(sessionId: string): Promise<Result<SessionSnapshot>>;
  /** Todas as mesas abertas, para a cozinha, o garçom e o gerente. */
  listOpenSessions(): Promise<SessionSnapshot[]>;
  closeSession(sessionId: string, actor: Role): Promise<Result<TableSession>>;

  createTab(
    input: { sessionId: string; customerName: string; peopleCount: number },
    actor: Role,
  ): Promise<Result<Tab>>;
  approveTab(tabId: string, actor: Role): Promise<Result<Tab>>;
  setTabStatus(tabId: string, to: TabStatus, actor: Role): Promise<Result<Tab>>;

  placeOrder(
    input: { tabId: string; lines: OrderLineInput[] },
    actor: Role,
  ): Promise<Result<{ order: Order; items: OrderItem[] }>>;
  setItemStatus(itemId: string, to: ItemStatus, actor: Role): Promise<Result<OrderItem>>;
  setItemShares(itemId: string, shares: ItemShare[], actor: Role): Promise<Result<OrderItem>>;

  createCall(
    input: { sessionId: string; tabId?: string; reason: CallReason; message?: string },
    actor: Role,
  ): Promise<Result<WaiterCall>>;
  setCallStatus(callId: string, to: CallStatus, actor: Role): Promise<Result<WaiterCall>>;

  /**
   * Eventos depois de `afterSeq` e o último `seq` existente. Com `sessionId`, só os daquela
   * mesa e os gerais (cardápio, configuração).
   */
  getEvents(afterSeq: number, sessionId?: string): Promise<{ events: StoreEvent[]; lastSeq: number }>;
};
