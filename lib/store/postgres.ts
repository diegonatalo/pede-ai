import { and, asc, eq, getTableColumns, gt, gte, inArray, isNull, max, or, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";
import { MAP_SPOTS, MENU_CATEGORIES, MENU_ITEMS, RESTAURANT, TABLES } from "@/lib/seed-data";
import type {
  MapSpot,
  MenuItem,
  Order,
  OrderItem,
  Restaurant,
  Tab,
  Table,
  TableSession,
  WaiterCall,
} from "@/types/domain";
import type { NewEvent, Repository, SessionRecord, SessionSecret, StoreEvent } from "@/types/store";

const {
  diningTables,
  events,
  mapSpots,
  menuCategories,
  menuItems,
  orderItems,
  orders,
  restaurants,
  tableSessions,
  tabs,
  waiterCalls,
} = schema;

type Db = ReturnType<typeof drizzle<typeof schema>>;
type Batch = [BatchItem<"pg">, ...BatchItem<"pg">[]];

// --- linhas do banco ↔ domínio (null no banco = campo ausente no domínio) ---

const toRestaurant = (row: typeof restaurants.$inferSelect): Restaurant => ({ ...row });

const toTable = (row: typeof diningTables.$inferSelect): Table => ({
  id: row.id,
  restaurantId: row.restaurantId,
  label: row.label,
  seats: row.seats,
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

const toEvent = ({ sessionId, ...row }: typeof events.$inferSelect): StoreEvent => ({
  ...row,
  type: row.type as StoreEvent["type"],
  actor: row.actor as StoreEvent["actor"],
  ...(sessionId !== null && { sessionId }),
});

const eventRow = (event: NewEvent): typeof events.$inferInsert => ({
  type: event.type,
  at: event.at,
  actor: event.actor,
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

/** Grava os dados de demonstração na primeira vez (sem mexer no que já existe). */
const seed = async (db: Db) => {
  await db.batch([
    db.insert(restaurants).values(RESTAURANT).onConflictDoNothing(),
    db.insert(diningTables).values(TABLES.map((table, position) => ({ ...table, position }))).onConflictDoNothing(),
    db
      .insert(mapSpots)
      .values(MAP_SPOTS.map((spot, position) => ({ ...spot, tableId: spot.tableId ?? null, position })))
      .onConflictDoNothing(),
    db.insert(menuCategories).values(MENU_CATEGORIES).onConflictDoNothing(),
    db.insert(menuItems).values(MENU_ITEMS.map((item, position) => ({ ...item, position }))).onConflictDoNothing(),
  ]);
};

/**
 * Repositório no Postgres (Neon, pelo driver HTTP). Cada operação é uma requisição só:
 * leituras em `batch`, e cada gravação num `batch`, que o Neon roda como uma transação.
 */
export const createPostgresRepository = (url: string): Repository => {
  const db: Db = drizzle(url, { schema });
  let seeded: Promise<void> | null = null;
  const ready = () => {
    seeded ??= seed(db).catch((error: unknown) => {
      seeded = null;
      throw error;
    });
    return seeded;
  };

  // Mesas, mapa e categorias não mudam com o app rodando: ficam guardados no processo.
  let tablesCache: Table[] | null = null;
  let spotsCache: MapSpot[] | null = null;

  const loadRecords = async (where: SQL): Promise<SessionRecord[]> => {
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
      await ready();
      const [row] = await db.select().from(restaurants).where(eq(restaurants.id, RESTAURANT.id));
      return toRestaurant(row);
    },

    async saveRestaurant(restaurant, event) {
      await ready();
      await db.batch([
        db.update(restaurants).set(restaurant).where(eq(restaurants.id, restaurant.id)),
        db.insert(events).values(eventRow(event)),
      ]);
    },

    async listTables() {
      await ready();
      tablesCache ??= (await db.select().from(diningTables).orderBy(asc(diningTables.position))).map(toTable);
      return structuredClone(tablesCache);
    },

    async listMapSpots() {
      await ready();
      spotsCache ??= (await db.select().from(mapSpots).orderBy(asc(mapSpots.position))).map(toSpot);
      return structuredClone(spotsCache);
    },

    async getMenu() {
      await ready();
      const [categories, items] = await db.batch([
        db.select().from(menuCategories).orderBy(asc(menuCategories.position)),
        db.select().from(menuItems).orderBy(asc(menuItems.position)),
      ]);
      return { categories, items: items.map(toMenuItem) };
    },

    async saveMenuItem(item, event) {
      await ready();
      const { id, ...fields } = item;
      await db.batch([
        db.update(menuItems).set(fields).where(eq(menuItems.id, id)),
        db.insert(events).values(eventRow(event)),
      ]);
    },

    async findSessionId(ref) {
      await ready();
      const [row] =
        "openAtTable" in ref
          ? await db
              .select({ id: tableSessions.id })
              .from(tableSessions)
              .where(and(eq(tableSessions.tableId, ref.openAtTable), eq(tableSessions.status, "open")))
          : "tabId" in ref
            ? await db.select({ id: tabs.sessionId }).from(tabs).where(eq(tabs.id, ref.tabId))
            : "itemId" in ref
              ? await db.select({ id: orderItems.sessionId }).from(orderItems).where(eq(orderItems.id, ref.itemId))
              : await db.select({ id: waiterCalls.sessionId }).from(waiterCalls).where(eq(waiterCalls.id, ref.callId));
      return row?.id ?? null;
    },

    async loadSession(sessionId) {
      await ready();
      const [record] = await loadRecords(eq(tableSessions.id, sessionId));
      return record ?? null;
    },

    async listSessions({ since }) {
      await ready();
      const open = eq(tableSessions.status, "open");
      // Datas em ISO UTC comparam certo como texto.
      return loadRecords(since ? (or(open, gte(tableSessions.openedAt, since)) as SQL) : open);
    },

    async insertSession({ session, secret }, event) {
      await ready();
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
          db.insert(events).values(eventRow(event)),
        ]);
        return true;
      } catch (error) {
        // Índice "uma sessão aberta por mesa": outro garçom abriu a mesa antes.
        if (pgError(error).code === "23505") return false;
        throw error;
      }
    },

    async saveSession(sessionId, expectedVersion, changes, event) {
      await ready();
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
      if (event) queries.push(db.insert(events).values(eventRow(event)));

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
      await ready();
      const filter =
        sessionId === undefined
          ? gt(events.seq, afterSeq)
          : and(gt(events.seq, afterSeq), or(eq(events.sessionId, sessionId), isNull(events.sessionId)));
      const [rows, [last]] = await db.batch([
        db.select().from(events).where(filter).orderBy(asc(events.seq)),
        db.select({ lastSeq: max(events.seq) }).from(events),
      ]);
      return { events: rows.map(toEvent), lastSeq: last?.lastSeq ?? 0 };
    },
  };
};
