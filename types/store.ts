import type { SharesError } from "@/lib/billing";
import type { Floor, FloorChange } from "@/lib/floor-editor";
import type { MenuChange } from "@/lib/menu-editor";
import type { RestaurantData } from "@/lib/restaurant-template";
import type {
  Actor,
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
  StaffMember,
  StaffRole,
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
  /** Outra pessoa mudou a mesma mesa ao mesmo tempo, mais de uma vez seguida. */
  | "conflict"
  | "wrong_pin"
  /** Categoria com itens não pode ser excluída. */
  | "category_not_empty"
  /** Cardápio no limite de categorias ou de itens. */
  | "menu_full"
  /** Já existe uma mesa com esse nome. */
  | "duplicate_label"
  /** Salão no limite de mesas ou de pontos no mapa. */
  | "floor_full"
  /** Mesa aberta agora não pode sair do salão. */
  | "table_in_use"
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
  | "menu_updated"
  | "floor_updated"
  | "call_created"
  | "call_status_changed"
  | "restaurant_updated"
  | "staff_created"
  | "staff_updated";

/** Registro de cada mudança. As telas consultam os eventos depois do último `seq` que viram. */
export type StoreEvent = {
  seq: number;
  type: EventType;
  at: IsoDateTime;
  actor: Role;
  /** Pessoa da equipe que fez a ação, quando foi alguém da equipe com PIN pessoal. */
  actorStaffId?: string;
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
  updateRestaurant(settings: RestaurantSettings, actor: Actor): Promise<Result<Restaurant>>;
  /** Mesas em uso, na ordem do salão. */
  listTables(): Promise<Table[]>;
  listMapSpots(): Promise<MapSpot[]>;
  getMenu(): Promise<Menu>;
  setItemAvailability(menuItemId: string, available: boolean, actor: Actor): Promise<Result<MenuItem>>;
  /** Gerente cria, edita, ordena ou exclui itens e categorias. Devolve o cardápio novo. */
  editMenu(change: MenuChange, actor: Actor): Promise<Result<Menu>>;
  /** Gerente cria, renomeia, ordena e arquiva mesas, e desenha o mapa. Devolve o salão em uso. */
  editFloor(change: FloorChange, actor: Actor): Promise<Result<{ tables: Table[]; mapSpots: MapSpot[] }>>;

  openSession(tableId: string, joinCode: string, actor: Actor): Promise<Result<TableSession>>;
  /** Código da mesa, para o garçom mostrar ao cliente. */
  getJoinCode(sessionId: string, actor: Actor): Promise<Result<string>>;
  /** Confere o código digitado; bloqueia a sessão por alguns minutos depois de muitos erros. */
  verifyJoinCode(sessionId: string, code: string): Promise<Result<true>>;
  getOpenSessionByTable(tableId: string): Promise<TableSession | null>;
  getSessionSnapshot(sessionId: string): Promise<Result<SessionSnapshot>>;
  /** Todas as mesas abertas, para a cozinha, o garçom e o gerente. */
  listOpenSessions(): Promise<SessionSnapshot[]>;
  closeSession(sessionId: string, actor: Actor): Promise<Result<TableSession>>;
  /** Mesas abertas agora e as abertas desde `since` (inclusive as já fechadas), para o gerente. */
  listSessionsSince(since: IsoDateTime, actor: Actor): Promise<Result<SessionSnapshot[]>>;

  createTab(
    input: { sessionId: string; customerName: string; peopleCount: number },
    actor: Actor,
  ): Promise<Result<Tab>>;
  approveTab(tabId: string, actor: Actor): Promise<Result<Tab>>;
  setTabStatus(tabId: string, to: TabStatus, actor: Actor): Promise<Result<Tab>>;

  placeOrder(
    input: { tabId: string; lines: OrderLineInput[] },
    actor: Actor,
  ): Promise<Result<{ order: Order; items: OrderItem[] }>>;
  setItemStatus(itemId: string, to: ItemStatus, actor: Actor): Promise<Result<OrderItem>>;
  setItemShares(itemId: string, shares: ItemShare[], actor: Actor): Promise<Result<OrderItem>>;

  createCall(
    input: { sessionId: string; tabId?: string; reason: CallReason; message?: string },
    actor: Actor,
  ): Promise<Result<WaiterCall>>;
  setCallStatus(callId: string, to: CallStatus, actor: Actor): Promise<Result<WaiterCall>>;

  /** Equipe do restaurante, sem os PINs (só o gerente). */
  listStaff(actor: Actor): Promise<Result<StaffMember[]>>;
  /** Cadastra a pessoa e devolve o PIN gerado, que só aparece desta vez. */
  createStaff(input: { name: string; role: StaffRole }, actor: Actor): Promise<Result<{ member: StaffMember; pin: string }>>;
  resetStaffPin(staffId: string, actor: Actor): Promise<Result<{ member: StaffMember; pin: string }>>;
  setStaffActive(staffId: string, active: boolean, actor: Actor): Promise<Result<StaffMember>>;
  /** Acha a pessoa ativa pelo PIN; muitos erros seguidos bloqueiam o login da equipe por alguns minutos. */
  verifyStaffPin(pin: string): Promise<Result<StaffMember>>;
  /** A pessoa, para conferir a cada requisição se ela continua ativa. */
  getStaffMember(staffId: string): Promise<StaffMember | null>;
  /**
   * Eventos depois de `afterSeq` e o último `seq` existente. Com `sessionId`, só os daquela
   * mesa e os gerais (cardápio, configuração).
   */
  getEvents(afterSeq: number, sessionId?: string): Promise<{ events: StoreEvent[]; lastSeq: number }>;
};

/** Dados secretos da mesa: só o garçom vê o código; erros seguidos bloqueiam por alguns minutos. */
export type SessionSecret = { joinCode: string; failedAttempts: number; lockedUntil?: number };

/** Tudo de uma mesa, como o repositório guarda. `version` sobe a cada gravação. */
export type SessionRecord = {
  session: TableSession;
  secret: SessionSecret;
  tabs: Tab[];
  orders: Order[];
  items: OrderItem[];
  calls: WaiterCall[];
  version: number;
};

/** O que um comando mudou numa mesa: só as linhas novas ou alteradas. */
export type SessionChanges = {
  session?: TableSession;
  secret?: SessionSecret;
  tabs?: Tab[];
  orders?: Order[];
  items?: OrderItem[];
  calls?: WaiterCall[];
};

export type NewEvent = Omit<StoreEvent, "seq">;

/** Erros seguidos de PIN da equipe, para bloquear tentativas em série. */
export type StaffGuard = { failedAttempts: number; lockedUntil?: number };

export type SessionRef = { openAtTable: string } | { tabId: string } | { itemId: string } | { callId: string };

/**
 * Onde os dados ficam (memória ou Postgres). Só carrega e grava; as regras ficam em
 * `lib/store/engine.ts`, iguais para os dois. Listas sempre na ordem em que foram criadas.
 */
export type Repository = {
  getRestaurant(): Promise<Restaurant>;
  saveRestaurant(restaurant: Restaurant, event: NewEvent): Promise<void>;
  /** Todas as mesas, inclusive as arquivadas (o histórico precisa delas). */
  listTables(): Promise<Table[]>;
  listMapSpots(): Promise<MapSpot[]>;
  /** Troca mesas e mapa de uma vez (a ordem das mesas é a ordem do salão). */
  saveFloor(floor: Floor, event: NewEvent): Promise<void>;
  getMenu(): Promise<Menu>;
  saveMenuItem(item: MenuItem, event: NewEvent): Promise<void>;
  /** Troca o cardápio inteiro (a ordem das listas é a ordem de exibição), numa gravação só. */
  saveMenu(menu: Menu, event: NewEvent): Promise<void>;

  findSessionId(ref: SessionRef): Promise<string | null>;
  loadSession(sessionId: string): Promise<SessionRecord | null>;
  /** Mesas abertas, ou abertas e as criadas a partir de `since` (ISO). */
  listSessions(filter: { since?: IsoDateTime }): Promise<SessionRecord[]>;
  /** Cria a mesa. `false` se a mesa já tem uma sessão aberta. */
  insertSession(record: Omit<SessionRecord, "version">, event: NewEvent): Promise<boolean>;
  /**
   * Grava as mudanças só se a mesa ainda está na versão `expectedVersion` (ninguém mexeu
   * desde a leitura). `false` em caso de conflito; quem chama lê de novo e tenta outra vez.
   */
  saveSession(
    sessionId: string,
    expectedVersion: number,
    changes: SessionChanges,
    event: NewEvent | null,
  ): Promise<boolean>;
  getEvents(afterSeq: number, sessionId?: string): Promise<{ events: StoreEvent[]; lastSeq: number }>;

  listStaff(): Promise<StaffMember[]>;
  findStaffByPinKey(pinKey: string): Promise<StaffMember | null>;
  findStaffById(staffId: string): Promise<StaffMember | null>;
  /** Grava a pessoa nova. `false` se a chave do PIN já é de outra pessoa do restaurante. */
  insertStaff(member: StaffMember, pinKey: string, event: NewEvent): Promise<boolean>;
  /** Atualiza a pessoa; `pinKey` nulo mantém o PIN. `false` se o PIN novo já é de outra pessoa. */
  updateStaff(member: StaffMember, pinKey: string | null, event: NewEvent): Promise<boolean>;
  getStaffGuard(): Promise<StaffGuard>;
  saveStaffGuard(guard: StaffGuard): Promise<void>;
};

/** Restaurante no cadastro geral (sem os dados de dentro dele). */
export type RestaurantRecord = { id: string; slug: string; name: string; ownerUserId: string | null };

/**
 * Cadastro dos restaurantes, fora de qualquer restaurante: achar pelo endereço ou pelo dono
 * e criar um novo. Os dados de dentro de cada restaurante ficam no `Repository` dele.
 */
export type RestaurantRegistry = {
  findBySlug(slug: string): Promise<RestaurantRecord | null>;
  listByOwner(ownerUserId: string): Promise<RestaurantRecord[]>;
  /** Grava o restaurante com salão, cardápio e equipe. `false` se o endereço já é de outro. */
  create(data: RestaurantData): Promise<boolean>;
};
