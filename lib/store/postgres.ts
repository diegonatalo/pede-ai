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
  lte,
  max,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ANONYMOUS_NAME } from "@/lib/privacy";
import type { PushStore } from "@/lib/push";
import { JOIN_LIMIT, windowActive, type CountAttempt, type RateLimitConfig, type RateLimiter } from "@/lib/rate-limit";
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
  rateLimits,
  pushSubscriptions,
} = schema;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Roda as consultas em ordem, numa transação só: grava tudo ou nada, e as leituras veem o
 * mesmo instante do banco. As consultas são montadas com o `tx`, senão sairiam da transação.
 */
const atomic = <const T extends readonly PromiseLike<unknown>[]>(db: Db, build: (tx: Tx) => T) =>
  db.transaction(async (tx) => {
    const results: unknown[] = [];
    for (const query of build(tx)) results.push(await query);
    return results as { -readonly [K in keyof T]: Awaited<T[K]> };
  });

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
const restaurantRows = (db: Tx, data: RestaurantData, pinKey: StaffPinKey) => ({
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
 * Repositório no Postgres (Neon, pelo driver `pg`). Cada gravação, e cada leitura de várias
 * tabelas, roda numa transação (`atomic`).
 */
export const createPostgresRepository = ({ restaurantId, db }: { restaurantId: string; db: Db }): Repository => {
  /** Sessões deste restaurante: toda consulta por comanda, item ou chamado passa por aqui. */
  const ownSessions = () =>
    db.select({ id: tableSessions.id }).from(tableSessions).where(eq(tableSessions.restaurantId, restaurantId));

  // Mesas, mapa e categorias não mudam com o app rodando: ficam guardados no processo.

  const loadRecords = async (condition: SQL): Promise<SessionRecord[]> => {
    // Nunca carrega mesa de outro restaurante, nem pelo id.
    const where = and(condition, eq(tableSessions.restaurantId, restaurantId)) as SQL;
    const ids = db.select({ id: tableSessions.id }).from(tableSessions).where(where);
    const [sessionRows, tabRows, orderRows, itemRows, callRows] = await atomic(db, (tx) => [
      tx.select().from(tableSessions).where(where).orderBy(asc(tableSessions.n)),
      tx.select().from(tabs).where(inArray(tabs.sessionId, ids)).orderBy(asc(tabs.n)),
      tx.select().from(orders).where(inArray(orders.sessionId, ids)).orderBy(asc(orders.n)),
      tx.select().from(orderItems).where(inArray(orderItems.sessionId, ids)).orderBy(asc(orderItems.n)),
      tx.select().from(waiterCalls).where(inArray(waiterCalls.sessionId, ids)).orderBy(asc(waiterCalls.n)),
    ] as const);
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
      await atomic(db, (tx) => [
        tx.update(restaurants).set(restaurant).where(eq(restaurants.id, restaurantId)),
        tx.insert(events).values(eventRow(event, restaurantId)),
      ] as const);
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
      await atomic(db, (tx) => {
        const writes: PromiseLike<unknown>[] = [];
        // Mesas não são apagadas (as sessões antigas apontam para elas): arquivar é marcar `archived`.
        if (floor.tables.length > 0) {
          writes.push(
            tx
              .insert(diningTables)
              .values(floor.tables.map((table, position) => ({ ...table, restaurantId, position })))
              .onConflictDoUpdate({ target: diningTables.id, set: replaceAll(diningTables, ["id"]), setWhere: ownTable }),
          );
        }
        writes.push(tx.delete(mapSpots).where(spotIds.length > 0 ? and(ownSpot, notInArray(mapSpots.id, spotIds)) : ownSpot));
        if (floor.mapSpots.length > 0) {
          writes.push(
            tx
              .insert(mapSpots)
              .values(floor.mapSpots.map((spot, position) => ({ ...spot, tableId: spot.tableId ?? null, restaurantId, position })))
              .onConflictDoUpdate({ target: mapSpots.id, set: replaceAll(mapSpots, ["id"]), setWhere: ownSpot }),
          );
        }
        writes.push(tx.insert(events).values(eventRow(event, restaurantId)));
        return writes;
      });
    },

    async getMenu() {
      const [categories, items] = await atomic(db, (tx) => [
        tx
          .select()
          .from(menuCategories)
          .where(eq(menuCategories.restaurantId, restaurantId))
          .orderBy(asc(menuCategories.position)),
        tx.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId)).orderBy(asc(menuItems.position)),
      ] as const);
      return { categories, items: items.map(toMenuItem) };
    },

    async saveMenuItem(item, event) {
      const { id, ...fields } = item;
      await atomic(db, (tx) => [
        tx.update(menuItems).set(fields).where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId))),
        tx.insert(events).values(eventRow(event, restaurantId)),
      ] as const);
    },

    async saveMenu(menu, event) {
      const ownCategory = eq(menuCategories.restaurantId, restaurantId);
      const ownItem = eq(menuItems.restaurantId, restaurantId);
      const categoryIds = menu.categories.map((category) => category.id);
      const itemIds = menu.items.map((item) => item.id);
      await atomic(db, (tx) => {
        const writes: PromiseLike<unknown>[] = [];
        // Upsert só troca linhas do próprio restaurante (`setWhere`); ids de outro ficam como estão.
        if (menu.categories.length > 0) {
          writes.push(
            tx
              .insert(menuCategories)
              .values(menu.categories.map((category, position) => ({ ...category, restaurantId, position })))
              .onConflictDoUpdate({ target: menuCategories.id, set: replaceAll(menuCategories, ["id"]), setWhere: ownCategory }),
          );
        }
        if (menu.items.length > 0) {
          writes.push(
            tx
              .insert(menuItems)
              .values(menu.items.map((item, position) => ({ ...item, restaurantId, position })))
              .onConflictDoUpdate({ target: menuItems.id, set: replaceAll(menuItems, ["id"]), setWhere: ownItem }),
          );
        }
        writes.push(
          tx.delete(menuItems).where(itemIds.length > 0 ? and(ownItem, notInArray(menuItems.id, itemIds)) : ownItem),
          tx
            .delete(menuCategories)
            .where(categoryIds.length > 0 ? and(ownCategory, notInArray(menuCategories.id, categoryIds)) : ownCategory),
          tx.insert(events).values(eventRow(event, restaurantId)),
        );
        return writes;
      });
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
        await atomic(db, (tx) => [
          tx.insert(tableSessions).values({
            ...session,
            closedAt: session.closedAt ?? null,
            joinCode: secret.joinCode,
            failedAttempts: secret.failedAttempts,
            lockedUntil: secret.lockedUntil ?? null,
            version: 1,
          }),
          tx.insert(events).values(eventRow(event, restaurantId)),
        ] as const);
        return true;
      } catch (error) {
        // Índice "uma sessão aberta por mesa": outro garçom abriu a mesa antes.
        if (pgError(error).code === "23505") return false;
        throw error;
      }
    },

    async saveSession(sessionId, expectedVersion, changes, event) {
      const build = (tx: Tx) => {
        const queries: PromiseLike<unknown>[] = [
          tx.execute(sql`select pede_ai_bump_session_version(${sessionId}, ${expectedVersion})`),
        ];
        if (changes.session || changes.secret) {
          queries.push(
            tx
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
          queries.push(tx.insert(tabs).values(changes.tabs).onConflictDoUpdate({ target: tabs.id, set: replaceAll(tabs) }));
        }
        if (changes.orders?.length) {
          queries.push(
            tx.insert(orders).values(changes.orders).onConflictDoUpdate({ target: orders.id, set: replaceAll(orders) }),
          );
        }
        if (changes.items?.length) {
          queries.push(
            tx
              .insert(orderItems)
              .values(changes.items.map((item) => ({ ...item, sessionId, note: item.note ?? null })))
              .onConflictDoUpdate({ target: orderItems.id, set: replaceAll(orderItems) }),
          );
        }
        if (changes.calls?.length) {
          queries.push(
            tx
              .insert(waiterCalls)
              .values(changes.calls.map((call) => ({ ...call, tabId: call.tabId ?? null, message: call.message ?? null })))
              .onConflictDoUpdate({ target: waiterCalls.id, set: replaceAll(waiterCalls) }),
          );
        }
        if (event) queries.push(tx.insert(events).values(eventRow(event, restaurantId)));
        return queries;
      };

      try {
        await atomic(db, build);
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
      const [rows, [last]] = await atomic(db, (tx) => [
        tx.select().from(events).where(filter).orderBy(asc(events.seq)),
        tx.select({ lastSeq: max(events.seq) }).from(events).where(own),
      ] as const);
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
        await atomic(db, (tx) => [
          tx.insert(staffMembers).values({ ...member, pinKey: key }),
          tx.insert(events).values(eventRow(event, restaurantId)),
        ] as const);
        return true;
      } catch (error) {
        // Índice "um PIN por restaurante": o PIN sorteado já é de outra pessoa.
        if (pgError(error).code === "23505") return false;
        throw error;
      }
    },

    async updateStaff(member, key, event) {
      try {
        await atomic(db, (tx) => [
          tx
            .update(staffMembers)
            .set({ name: member.name, role: member.role, active: member.active, ...(key !== null && { pinKey: key }) })
            .where(and(eq(staffMembers.id, member.id), eq(staffMembers.restaurantId, restaurantId))),
          tx.insert(events).values(eventRow(event, restaurantId)),
        ] as const);
        return true;
      } catch (error) {
        if (pgError(error).code === "23505") return false;
        throw error;
      }
    },

    // Um UPDATE só: a linha do restaurante fica travada durante ele, então duas tentativas ao
    // mesmo tempo nunca leem a mesma contagem. Sem linha de volta, o login está bloqueado.
    async claimStaffPinAttempt(nowMs, { max, lockMs }) {
      const reachesMax = sql`${restaurants.staffFailedAttempts} + 1 >= ${max}`;
      const rows = await db
        .update(restaurants)
        .set({
          staffFailedAttempts: sql`case when ${reachesMax} then 0 else ${restaurants.staffFailedAttempts} + 1 end`,
          staffLockedUntil: sql`case when ${reachesMax} then ${nowMs + lockMs}::bigint else null end`,
        })
        .where(
          and(
            eq(restaurants.id, restaurantId),
            or(isNull(restaurants.staffLockedUntil), lte(restaurants.staffLockedUntil, nowMs)),
          ),
        )
        .returning({ id: restaurants.id });
      return rows.length > 0;
    },

    async resetStaffPinAttempts() {
      await db
        .update(restaurants)
        .set({ staffFailedAttempts: 0, staffLockedUntil: null })
        .where(
          and(
            eq(restaurants.id, restaurantId),
            or(gt(restaurants.staffFailedAttempts, 0), isNotNull(restaurants.staffLockedUntil)),
          ),
        );
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
export const createPostgresRegistry = ({
  db,
  pinKey = defaultStaffPinKey(),
}: {
  db: Db;
  pinKey?: StaffPinKey;
}): RestaurantRegistry => {
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
      try {
        await atomic(db, (tx) => {
          const rows = restaurantRows(tx, data, pinKey);
          return [rows.restaurant, rows.tables, rows.spots, rows.categories, rows.items, rows.staff] as const;
        });
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
      await atomic(db, (tx) => [
        tx.delete(orderItems).where(inArray(orderItems.sessionId, sessions)),
        tx.delete(orders).where(inArray(orders.sessionId, sessions)),
        tx.delete(waiterCalls).where(inArray(waiterCalls.sessionId, sessions)),
        tx.delete(tabs).where(inArray(tabs.sessionId, sessions)),
        tx.delete(tableSessions).where(eq(tableSessions.restaurantId, restaurantId)),
        tx.delete(events).where(eq(events.restaurantId, restaurantId)),
        tx.delete(staffMembers).where(eq(staffMembers.restaurantId, restaurantId)),
        tx.delete(menuItems).where(eq(menuItems.restaurantId, restaurantId)),
        tx.delete(menuCategories).where(eq(menuCategories.restaurantId, restaurantId)),
        tx.delete(mapSpots).where(eq(mapSpots.restaurantId, restaurantId)),
        tx.delete(diningTables).where(eq(diningTables.restaurantId, restaurantId)),
        tx.delete(pushSubscriptions).where(eq(pushSubscriptions.restaurantId, restaurantId)),
        tx.delete(restaurants).where(eq(restaurants.id, restaurantId)),
      ] as const);
    },
    async anonymizeClosedBefore(cutoff) {
      const old = db
        .select({ id: tableSessions.id })
        .from(tableSessions)
        .where(and(eq(tableSessions.status, "closed"), lt(tableSessions.closedAt, cutoff)));
      const [renamed] = await atomic(db, (tx) => [
        tx
          .update(tabs)
          .set({ customerName: ANONYMOUS_NAME })
          .where(and(inArray(tabs.sessionId, old), ne(tabs.customerName, ANONYMOUS_NAME)))
          .returning({ id: tabs.id }),
        tx.update(orderItems).set({ note: null }).where(and(inArray(orderItems.sessionId, old), isNotNull(orderItems.note))),
        tx
          .update(waiterCalls)
          .set({ message: null })
          .where(and(inArray(waiterCalls.sessionId, old), isNotNull(waiterCalls.message))),
      ] as const);
      return renamed.length;
    },
  };
};

/** Conta tentativas (login) num upsert só, que devolve o número desta tentativa. */
export const createPostgresAttemptCounter =
  (db: Db): CountAttempt =>
  async ({ key, nowMs, windowMs, max }) => {
    const expired = sql`${rateLimits.windowStart} <= ${nowMs - windowMs}`;
    const [row] = await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: nowMs })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${expired} then 1 else least(${rateLimits.count} + 1, ${max + 1}) end`,
          windowStart: sql`case when ${expired} then ${nowMs} else ${rateLimits.windowStart} end`,
        },
      })
      .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });
    return row;
  };

/**
 * Limitador no Postgres: vale para todas as instâncias da Vercel. Somar uma falha é um upsert
 * atômico (duas requisições ao mesmo tempo não perdem contagem).
 */
export const createPostgresRateLimiter = ({
  db,
  failures = JOIN_LIMIT.failures,
  windowMs = JOIN_LIMIT.windowMs,
}: { db: Db } & Partial<RateLimitConfig>): RateLimiter => {
  return {
    async isBlocked(key, nowMs) {
      const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
      return Boolean(row && windowActive(row.windowStart, nowMs, windowMs) && row.count >= failures);
    },
    async recordFailure(key, nowMs) {
      const expired = sql`${rateLimits.windowStart} <= ${nowMs - windowMs}`;
      await db
        .insert(rateLimits)
        .values({ key, count: 1, windowStart: nowMs })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: {
            count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
            windowStart: sql`case when ${expired} then ${nowMs} else ${rateLimits.windowStart} end`,
          },
        });
    },
    async prune(beforeMs) {
      const removed = await db.delete(rateLimits).where(lt(rateLimits.windowStart, beforeMs)).returning({ key: rateLimits.key });
      return removed.length;
    },
  };
};

/** Inscrições de push no Postgres (vale para todas as instâncias). */
export const createPostgresPushStore = ({ db }: { db: Db }): PushStore => {
  return {
    async save(record) {
      await db
        .insert(pushSubscriptions)
        .values(record)
        .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: replaceAll(pushSubscriptions, ["endpoint"]) });
    },
    async remove(endpoint) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    },
    async listForRestaurant(restaurantId) {
      return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.restaurantId, restaurantId));
    },
  };
};
