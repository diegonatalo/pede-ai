import {
  and,
  asc,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  max,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";
import { ANONYMOUS_NAME } from "@/lib/privacy";
import type { RestaurantData } from "@/lib/restaurant-template";
import { defaultStaffPinKey, type StaffPinKey } from "@/lib/staff-pin";
import type {
  MapSpot,
  MenuItem,
  Order,
  OrderItem,
  Restaurant,
  StaffMember,
  Tab,
  Table,
  TableSession,
  WaiterCall,
} from "@/types/domain";
import type {
  NewEvent,
  Repository,
  RestaurantRecord,
  RestaurantRegistry,
  SessionRecord,
  SessionSecret,
  StoreEvent,
} from "@/types/store";

const {
  diningTables,
  events,
  mapSpots,
  menuCategories,
  menuItems,
  orderItems,
  orders,
  restaurants,
  staffMembers,
  tableSessions,
  tabs,
  waiterCalls,
} = schema;

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Uma conexão (HTTP) para repartir entre o cadastro e os repositórios de cada restaurante. */
export const createPostgresDb = (url: string): Db => drizzle(url, { schema });
type Batch = [BatchItem<"pg">, ...BatchItem<"pg">[]];

// --- linhas do banco ↔ domínio (null no banco = campo ausente no domínio) ---

const toRestaurant = (row: typeof restaurants.$inferSelect): Restaurant => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  serviceFeePercent: row.serviceFeePercent,
  couvertCents: row.couvertCents,
  requireFirstOrderApproval: row.requireFirstOrderApproval,
});

const toStaff = (row: typeof staffMembers.$inferSelect): StaffMember => ({
  id: row.id,
  restaurantId: row.restaurantId,
  name: row.name,
  role: row.role as StaffMember["role"],
  active: row.active,
  system: row.system,
  createdAt: row.createdAt,
});

const toTable = (row: typeof diningTables.$inferSelect): Table => ({
  id: row.id,
  restaurantId: row.restaurantId,
  label: row.label,
  archived: row.archived,
});

const toSpot = (row: typeof mapSpots.$inferSelect): MapSpot => ({
  id: row.id,
  restaurantId: row.restaurantId,
  kind: row.kind as MapSpot["kind"],
  label: row.label,
  ...(row.tableId !== null && { tableId: row.tableId }),
  x: row.x,
  y: row.y,
  w: row.w,
  h: row.h,
});

const toMenuItem = (row: typeof menuItems.$inferSelect): MenuItem => ({
  id: row.id,
  restaurantId: row.restaurantId,
  categoryId: row.categoryId,
  name: row.name,
  description: row.description,
  priceCents: row.priceCents,
  station: row.station as MenuItem["station"],
  available: row.available,
});

const toSession = (row: typeof tableSessions.$inferSelect): TableSession => ({
  id: row.id,
  restaurantId: row.restaurantId,
  tableId: row.tableId,
  status: row.status as TableSession["status"],
  openedAt: row.openedAt,
  ...(row.closedAt !== null && { closedAt: row.closedAt }),
});

const toSecret = (row: typeof tableSessions.$inferSelect): SessionSecret => ({
  joinCode: row.joinCode,
  failedAttempts: row.failedAttempts,
  ...(row.lockedUntil !== null && { lockedUntil: row.lockedUntil }),
});

const toTab = (row: typeof tabs.$inferSelect): Tab => ({
  id: row.id,
  sessionId: row.sessionId,
  customerName: row.customerName,
  peopleCount: row.peopleCount,
  status: row.status as Tab["status"],
  approved: row.approved,
  createdAt: row.createdAt,
});

const toOrder = (row: typeof orders.$inferSelect): Order => ({
  id: row.id,
  sessionId: row.sessionId,
  tabId: row.tabId,
  createdAt: row.createdAt,
});

const toItem = (row: typeof orderItems.$inferSelect): OrderItem => ({
  id: row.id,
  orderId: row.orderId,
  menuItemId: row.menuItemId,
  nameSnapshot: row.nameSnapshot,
  unitPriceCents: row.unitPriceCents,
  quantity: row.quantity,
  ...(row.note !== null && { note: row.note }),
  station: row.station as OrderItem["station"],
  status: row.status as OrderItem["status"],
  shares: row.shares,
  updatedAt: row.updatedAt,
  timeline: row.timeline,
});

const toCall = (row: typeof waiterCalls.$inferSelect): WaiterCall => ({
  id: row.id,
  sessionId: row.sessionId,
  ...(row.tabId !== null && { tabId: row.tabId }),
  reason: row.reason as WaiterCall["reason"],
  ...(row.message !== null && { message: row.message }),
  status: row.status as WaiterCall["status"],
  createdAt: row.createdAt,
});

const toEvent = (row: typeof events.$inferSelect): StoreEvent => ({
  seq: row.seq,
  type: row.type as StoreEvent["type"],
  at: row.at,
  actor: row.actor as StoreEvent["actor"],
  ...(row.actorStaffId !== null && { actorStaffId: row.actorStaffId }),
  ...(row.sessionId !== null && { sessionId: row.sessionId }),
  entityId: row.entityId,
});

const eventRow = (event: NewEvent, restaurantId: string): typeof events.$inferInsert => ({
  restaurantId,
  type: event.type,
  at: event.at,
  actor: event.actor,
  actorStaffId: event.actorStaffId ?? null,
  entityId: event.entityId,
  sessionId: event.sessionId ?? null,
});

/** `SET coluna = excluded.coluna` para todas as colunas, menos as chaves: o upsert troca a linha inteira. */
const replaceAll = (table: PgTable, skip: string[] = ["id", "n"]): Record<string, SQL> =>
  Object.fromEntries(
    Object.entries(getTableColumns(table))
      .filter(([key]) => !skip.includes(key))
      .map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)]),
  );

/** Procura o código do Postgres (e a mensagem) no erro e nas causas que o Drizzle encadeia. */
const pgError = (error: unknown): { code?: string; message: string } => {
  let current: unknown = error;
  const messages: string[] = [];
  let code: string | undefined;
  while (current && typeof current === "object") {
    const entry = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof entry.code === "string") code ??= entry.code;
    if (typeof entry.message === "string") messages.push(entry.message);
    current = entry.cause;
  }
  return { code, message: messages.join(" | ") };
};

/** Linhas de um restaurante inteiro (configuração, salão, cardápio e equipe) para gravar de uma vez. */
const restaurantRows = (db: Db, data: RestaurantData, pinKey: StaffPinKey) => ({
  restaurant: db.insert(restaurants).values({ ...data.restaurant, ownerUserId: data.ownerUserId }),
  tables: db.insert(diningTables).values(data.tables.map((table, position) => ({ ...table, position }))),
  spots: db
    .insert(mapSpots)
    .values(data.mapSpots.map((spot, position) => ({ ...spot, tableId: spot.tableId ?? null, position }))),
  categories: db.insert(menuCategories).values(data.categories),
  items: db.insert(menuItems).values(data.menuItems.map((item, position) => ({ ...item, position }))),
  staff: db
    .insert(staffMembers)
    .values(data.staff.map(({ pin, ...member }) => ({ ...member, pinKey: pinKey(member.restaurantId, pin) }))),
});


/**
 * Repositório no Postgres (Neon, pelo driver HTTP). Cada operação é uma requisição só:
 * leituras em `batch`, e cada gravação num `batch`, que o Neon roda como uma transação.
 */
export const createPostgresRepository = (
  url: string,
  { restaurantId, db: shared }: { restaurantId: string; db?: Db },
): Repository => {
  const db: Db = shared ?? drizzle(url, { schema });
  /** Sessões deste restaurante: toda consulta por comanda, item ou chamado passa por aqui. */
  const ownSessions = () =>
    db.select({ id: tableSessions.id }).from(tableSessions).where(eq(tableSessions.restaurantId, restaurantId));

  // Mesas, mapa e categorias não mudam com o app rodando: ficam guardados no processo.

  const loadRecords = async (condition: SQL): Promise<SessionRecord[]> => {
    // Nunca carrega mesa de outro restaurante, nem pelo id.
    const where = and(condition, eq(tableSessions.restaurantId, restaurantId)) as SQL;
    const ids = db.select({ id: tableSessions.id }).from(tableSessions).where(where);
    const [sessionRows, tabRows, orderRows, itemRows, callRows] = await db.batch([
      db.select().from(tableSessions).where(where).orderBy(asc(tableSessions.n)),
      db.select().from(tabs).where(inArray(tabs.sessionId, ids)).orderBy(asc(tabs.n)),
      db.select().from(orders).where(inArray(orders.sessionId, ids)).orderBy(asc(orders.n)),
      db.select().from(orderItems).where(inArray(orderItems.sessionId, ids)).orderBy(asc(orderItems.n)),
      db.select().from(waiterCalls).where(inArray(waiterCalls.sessionId, ids)).orderBy(asc(waiterCalls.n)),
    ]);
    return sessionRows.map((row) => ({
      session: toSession(row),
      secret: toSecret(row),
      tabs: tabRows.filter((entry) => entry.sessionId === row.id).map(toTab),
      orders: orderRows.filter((entry) => entry.sessionId === row.id).map(toOrder),
      items: itemRows.filter((entry) => entry.sessionId === row.id).map(toItem),
      calls: callRows.filter((entry) => entry.sessionId === row.id).map(toCall),
      version: row.version,
    }));
  };

  return {
    async getRestaurant() {
      const [row] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
      return toRestaurant(row);
    },

    async saveRestaurant(restaurant, event) {
      await db.batch([
        db.update(restaurants).set(restaurant).where(eq(restaurants.id, restaurantId)),
        db.insert(events).values(eventRow(event, restaurantId)),
      ]);
    },

    // Sem cache: o gerente edita o salão, e cada instância da Vercel precisa ver a mudança.
    async listTables() {
      const rows = await db
        .select()
        .from(diningTables)
        .where(eq(diningTables.restaurantId, restaurantId))
        .orderBy(asc(diningTables.position));
      return rows.map(toTable);
    },

    async listMapSpots() {
      const rows = await db
        .select()
        .from(mapSpots)
        .where(eq(mapSpots.restaurantId, restaurantId))
        .orderBy(asc(mapSpots.position));
      return rows.map(toSpot);
    },

    async saveFloor(floor, event) {
      const ownTable = eq(diningTables.restaurantId, restaurantId);
      const ownSpot = eq(mapSpots.restaurantId, restaurantId);
      const spotIds = floor.mapSpots.map((spot) => spot.id);
      const writes: BatchItem<"pg">[] = [];
      // Mesas não são apagadas (as sessões antigas apontam para elas): arquivar é marcar `archived`.
      if (floor.tables.length > 0) {
        writes.push(
          db
            .insert(diningTables)
            .values(floor.tables.map((table, position) => ({ ...table, restaurantId, position })))
            .onConflictDoUpdate({ target: diningTables.id, set: replaceAll(diningTables, ["id"]), setWhere: ownTable }),
        );
      }
      writes.push(db.delete(mapSpots).where(spotIds.length > 0 ? and(ownSpot, notInArray(mapSpots.id, spotIds)) : ownSpot));
      if (floor.mapSpots.length > 0) {
        writes.push(
          db
            .insert(mapSpots)
            .values(floor.mapSpots.map((spot, position) => ({ ...spot, tableId: spot.tableId ?? null, restaurantId, position })))
            .onConflictDoUpdate({ target: mapSpots.id, set: replaceAll(mapSpots, ["id"]), setWhere: ownSpot }),
        );
      }
      writes.push(db.insert(events).values(eventRow(event, restaurantId)));
      await db.batch(writes as Batch);
    },

    async getMenu() {
      const [categories, items] = await db.batch([
        db
          .select()
          .from(menuCategories)
          .where(eq(menuCategories.restaurantId, restaurantId))
          .orderBy(asc(menuCategories.position)),
        db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId)).orderBy(asc(menuItems.position)),
      ]);
      return { categories, items: items.map(toMenuItem) };
    },

    async saveMenuItem(item, event) {
      const { id, ...fields } = item;
      await db.batch([
        db.update(menuItems).set(fields).where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId))),
        db.insert(events).values(eventRow(event, restaurantId)),
      ]);
    },

    async saveMenu(menu, event) {
      const ownCategory = eq(menuCategories.restaurantId, restaurantId);
      const ownItem = eq(menuItems.restaurantId, restaurantId);
      const categoryIds = menu.categories.map((category) => category.id);
      const itemIds = menu.items.map((item) => item.id);
      const writes: BatchItem<"pg">[] = [];
      // Upsert só troca linhas do próprio restaurante (`setWhere`); ids de outro ficam como estão.
      if (menu.categories.length > 0) {
        writes.push(
          db
            .insert(menuCategories)
            .values(menu.categories.map((category, position) => ({ ...category, restaurantId, position })))
            .onConflictDoUpdate({ target: menuCategories.id, set: replaceAll(menuCategories, ["id"]), setWhere: ownCategory }),
        );
      }
      if (menu.items.length > 0) {
        writes.push(
          db
            .insert(menuItems)
            .values(menu.items.map((item, position) => ({ ...item, restaurantId, position })))
            .onConflictDoUpdate({ target: menuItems.id, set: replaceAll(menuItems, ["id"]), setWhere: ownItem }),
        );
      }
      writes.push(
        db.delete(menuItems).where(itemIds.length > 0 ? and(ownItem, notInArray(menuItems.id, itemIds)) : ownItem),
        db
          .delete(menuCategories)
          .where(categoryIds.length > 0 ? and(ownCategory, notInArray(menuCategories.id, categoryIds)) : ownCategory),
        db.insert(events).values(eventRow(event, restaurantId)),
      );
      await db.batch(writes as Batch);
    },

    async findSessionId(ref) {
      const [row] =
        "openAtTable" in ref
          ? await db
              .select({ id: tableSessions.id })
              .from(tableSessions)
              .where(
                and(
                  eq(tableSessions.restaurantId, restaurantId),
                  eq(tableSessions.tableId, ref.openAtTable),
                  eq(tableSessions.status, "open"),
                ),
              )
          : "tabId" in ref
            ? await db
                .select({ id: tabs.sessionId })
                .from(tabs)
                .where(and(eq(tabs.id, ref.tabId), inArray(tabs.sessionId, ownSessions())))
            : "itemId" in ref
              ? await db
                  .select({ id: orderItems.sessionId })
                  .from(orderItems)
                  .where(and(eq(orderItems.id, ref.itemId), inArray(orderItems.sessionId, ownSessions())))
              : await db
                  .select({ id: waiterCalls.sessionId })
                  .from(waiterCalls)
                  .where(and(eq(waiterCalls.id, ref.callId), inArray(waiterCalls.sessionId, ownSessions())));
      return row?.id ?? null;
    },

    async loadSession(sessionId) {
      const [record] = await loadRecords(eq(tableSessions.id, sessionId));
      return record ?? null;
    },

    async listSessions({ since }) {
      const open = eq(tableSessions.status, "open");
      // Datas em ISO UTC comparam certo como texto.
      return loadRecords(since ? (or(open, gte(tableSessions.openedAt, since)) as SQL) : open);
    },

    async insertSession({ session, secret }, event) {
      try {
        await db.batch([
          db.insert(tableSessions).values({
            ...session,
            closedAt: session.closedAt ?? null,
            joinCode: secret.joinCode,
            failedAttempts: secret.failedAttempts,
            lockedUntil: secret.lockedUntil ?? null,
            version: 1,
          }),
          db.insert(events).values(eventRow(event, restaurantId)),
        ]);
        return true;
      } catch (error) {
        // Índice "uma sessão aberta por mesa": outro garçom abriu a mesa antes.
        if (pgError(error).code === "23505") return false;
        throw error;
      }
    },

    async saveSession(sessionId, expectedVersion, changes, event) {
      const queries: BatchItem<"pg">[] = [
        db.execute(sql`select pede_ai_bump_session_version(${sessionId}, ${expectedVersion})`),
      ];
      if (changes.session || changes.secret) {
        queries.push(
          db
            .update(tableSessions)
            .set({
              ...(changes.session && { status: changes.session.status, closedAt: changes.session.closedAt ?? null }),
              ...(changes.secret && {
                joinCode: changes.secret.joinCode,
                failedAttempts: changes.secret.failedAttempts,
                lockedUntil: changes.secret.lockedUntil ?? null,
              }),
            })
            .where(eq(tableSessions.id, sessionId)),
        );
      }
      if (changes.tabs?.length) {
        queries.push(db.insert(tabs).values(changes.tabs).onConflictDoUpdate({ target: tabs.id, set: replaceAll(tabs) }));
      }
      if (changes.orders?.length) {
        queries.push(
          db.insert(orders).values(changes.orders).onConflictDoUpdate({ target: orders.id, set: replaceAll(orders) }),
        );
      }
      if (changes.items?.length) {
        queries.push(
          db
            .insert(orderItems)
            .values(changes.items.map((item) => ({ ...item, sessionId, note: item.note ?? null })))
            .onConflictDoUpdate({ target: orderItems.id, set: replaceAll(orderItems) }),
        );
      }
      if (changes.calls?.length) {
        queries.push(
          db
            .insert(waiterCalls)
            .values(changes.calls.map((call) => ({ ...call, tabId: call.tabId ?? null, message: call.message ?? null })))
            .onConflictDoUpdate({ target: waiterCalls.id, set: replaceAll(waiterCalls) }),
        );
      }
      if (event) queries.push(db.insert(events).values(eventRow(event, restaurantId)));

      try {
        await db.batch(queries as Batch);
        return true;
      } catch (error) {
        const { code, message } = pgError(error);
        if (code === "40001" || message.includes("pede_ai_conflict")) return false;
        throw error;
      }
    },

    async getEvents(afterSeq, sessionId) {
      const own = eq(events.restaurantId, restaurantId);
      const filter =
        sessionId === undefined
          ? and(own, gt(events.seq, afterSeq))
          : and(own, gt(events.seq, afterSeq), or(eq(events.sessionId, sessionId), isNull(events.sessionId)));
      const [rows, [last]] = await db.batch([
        db.select().from(events).where(filter).orderBy(asc(events.seq)),
        db.select({ lastSeq: max(events.seq) }).from(events).where(own),
      ]);
      return { events: rows.map(toEvent), lastSeq: last?.lastSeq ?? 0 };
    },

    async listStaff() {
      const rows = await db
        .select()
        .from(staffMembers)
        .where(eq(staffMembers.restaurantId, restaurantId))
        .orderBy(asc(staffMembers.n));
      return rows.map(toStaff);
    },

    async findStaffByPinKey(key) {
      const [row] = await db
        .select()
        .from(staffMembers)
        .where(and(eq(staffMembers.restaurantId, restaurantId), eq(staffMembers.pinKey, key)));
      return row ? toStaff(row) : null;
    },

    async findStaffById(staffId) {
      const [row] = await db
        .select()
        .from(staffMembers)
        .where(and(eq(staffMembers.id, staffId), eq(staffMembers.restaurantId, restaurantId)));
      return row ? toStaff(row) : null;
    },

    async insertStaff(member, key, event) {
      try {
        await db.batch([
          db.insert(staffMembers).values({ ...member, pinKey: key }),
          db.insert(events).values(eventRow(event, restaurantId)),
        ]);
        return true;
      } catch (error) {
        // Índice "um PIN por restaurante": o PIN sorteado já é de outra pessoa.
        if (pgError(error).code === "23505") return false;
        throw error;
      }
    },

    async updateStaff(member, key, event) {
      try {
        await db.batch([
          db
            .update(staffMembers)
            .set({ name: member.name, role: member.role, active: member.active, ...(key !== null && { pinKey: key }) })
            .where(and(eq(staffMembers.id, member.id), eq(staffMembers.restaurantId, restaurantId))),
          db.insert(events).values(eventRow(event, restaurantId)),
        ]);
        return true;
      } catch (error) {
        if (pgError(error).code === "23505") return false;
        throw error;
      }
    },

    async getStaffGuard() {
      const [row] = await db
        .select({ failedAttempts: restaurants.staffFailedAttempts, lockedUntil: restaurants.staffLockedUntil })
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId));
      return {
        failedAttempts: row?.failedAttempts ?? 0,
        ...(row?.lockedUntil != null && { lockedUntil: row.lockedUntil }),
      };
    },

    async saveStaffGuard(guard) {
      await db
        .update(restaurants)
        .set({ staffFailedAttempts: guard.failedAttempts, staffLockedUntil: guard.lockedUntil ?? null })
        .where(eq(restaurants.id, restaurantId));
    },
  };
};

const toRecord = (row: typeof restaurants.$inferSelect): RestaurantRecord => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  ownerUserId: row.ownerUserId,
});

/** Cadastro dos restaurantes no Postgres. Criar um restaurante grava tudo numa transação só. */
export const createPostgresRegistry = (
  url: string,
  { pinKey = defaultStaffPinKey(), db: shared }: { pinKey?: StaffPinKey; db?: Db } = {},
): RestaurantRegistry => {
  const db: Db = shared ?? drizzle(url, { schema });
  return {
    async findBySlug(slug) {
      const [row] = await db.select().from(restaurants).where(eq(restaurants.slug, slug));
      return row ? toRecord(row) : null;
    },
    async listByOwner(ownerUserId) {
      const rows = await db.select().from(restaurants).where(eq(restaurants.ownerUserId, ownerUserId));
      return rows.map(toRecord);
    },
    async create(data) {
      const rows = restaurantRows(db, data, pinKey);
      try {
        await db.batch([rows.restaurant, rows.tables, rows.spots, rows.categories, rows.items, rows.staff]);
        return true;
      } catch (error) {
        // Endereço (slug) já usado por outro restaurante.
        if (pgError(error).code === "23505") return false;
        throw error;
      }
    },
    async remove(restaurantId) {
      const sessions = db
        .select({ id: tableSessions.id })
        .from(tableSessions)
        .where(eq(tableSessions.restaurantId, restaurantId));
      // Numa transação, dos filhos para os pais (as chaves estrangeiras não apagam em cascata).
      await db.batch([
        db.delete(orderItems).where(inArray(orderItems.sessionId, sessions)),
        db.delete(orders).where(inArray(orders.sessionId, sessions)),
        db.delete(waiterCalls).where(inArray(waiterCalls.sessionId, sessions)),
        db.delete(tabs).where(inArray(tabs.sessionId, sessions)),
        db.delete(tableSessions).where(eq(tableSessions.restaurantId, restaurantId)),
        db.delete(events).where(eq(events.restaurantId, restaurantId)),
        db.delete(staffMembers).where(eq(staffMembers.restaurantId, restaurantId)),
        db.delete(menuItems).where(eq(menuItems.restaurantId, restaurantId)),
        db.delete(menuCategories).where(eq(menuCategories.restaurantId, restaurantId)),
        db.delete(mapSpots).where(eq(mapSpots.restaurantId, restaurantId)),
        db.delete(diningTables).where(eq(diningTables.restaurantId, restaurantId)),
        db.delete(restaurants).where(eq(restaurants.id, restaurantId)),
      ]);
    },
    async anonymizeClosedBefore(cutoff) {
      const old = db
        .select({ id: tableSessions.id })
        .from(tableSessions)
        .where(and(eq(tableSessions.status, "closed"), lt(tableSessions.closedAt, cutoff)));
      const [renamed] = await db.batch([
        db
          .update(tabs)
          .set({ customerName: ANONYMOUS_NAME })
          .where(and(inArray(tabs.sessionId, old), ne(tabs.customerName, ANONYMOUS_NAME)))
          .returning({ id: tabs.id }),
        db.update(orderItems).set({ note: null }).where(and(inArray(orderItems.sessionId, old), isNotNull(orderItems.note))),
        db
          .update(waiterCalls)
          .set({ message: null })
          .where(and(inArray(waiterCalls.sessionId, old), isNotNull(waiterCalls.message))),
      ]);
      return renamed.length;
    },
  };
};
