import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { ItemShare, ItemStatus } from "@/types/domain";

/**
 * Banco do pede-ai (Postgres no Neon). Datas em texto ISO 8601 (UTC), como no domínio;
 * dinheiro em centavos inteiros. `n` (bigserial) só guarda a ordem de criação das linhas.
 * Toda tabela leva `restaurant_id` (direto ou pela sessão), pensando em vários restaurantes.
 */

export const restaurants = pgTable("restaurants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  serviceFeePercent: integer("service_fee_percent").notNull(),
  couvertCents: integer("couvert_cents").notNull(),
  requireFirstOrderApproval: boolean("require_first_order_approval").notNull(),
});

export const diningTables = pgTable("dining_tables", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  label: text("label").notNull(),
  seats: integer("seats").notNull(),
  position: integer("position").notNull(),
});

export const mapSpots = pgTable("map_spots", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  tableId: text("table_id").references(() => diningTables.id),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  w: integer("w").notNull(),
  h: integer("h").notNull(),
  position: integer("position").notNull(),
});

export const menuCategories = pgTable("menu_categories", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});

export const menuItems = pgTable("menu_items", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  categoryId: text("category_id")
    .notNull()
    .references(() => menuCategories.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceCents: integer("price_cents").notNull(),
  station: text("station").notNull(),
  available: boolean("available").notNull(),
  position: integer("position").notNull(),
});

export const tableSessions = pgTable(
  "table_sessions",
  {
    id: text("id").primaryKey(),
    n: bigserial("n", { mode: "number" }).notNull(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    tableId: text("table_id")
      .notNull()
      .references(() => diningTables.id),
    status: text("status").notNull(),
    openedAt: text("opened_at").notNull(),
    closedAt: text("closed_at"),
    joinCode: text("join_code").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: bigint("locked_until", { mode: "number" }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    // Uma sessão aberta por mesa: dois garçons abrindo ao mesmo tempo não criam duas.
    uniqueIndex("table_sessions_one_open_per_table").on(table.tableId).where(sql`${table.status} = 'open'`),
    index("table_sessions_opened_at").on(table.openedAt),
  ],
);

export const tabs = pgTable(
  "tabs",
  {
    id: text("id").primaryKey(),
    n: bigserial("n", { mode: "number" }).notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => tableSessions.id),
    customerName: text("customer_name").notNull(),
    peopleCount: integer("people_count").notNull(),
    status: text("status").notNull(),
    approved: boolean("approved").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("tabs_session").on(table.sessionId)],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    n: bigserial("n", { mode: "number" }).notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => tableSessions.id),
    tabId: text("tab_id")
      .notNull()
      .references(() => tabs.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("orders_session").on(table.sessionId)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    n: bigserial("n", { mode: "number" }).notNull(),
    // Repetido do pedido para carregar a mesa inteira numa consulta só.
    sessionId: text("session_id")
      .notNull()
      .references(() => tableSessions.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    menuItemId: text("menu_item_id").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    note: text("note"),
    station: text("station").notNull(),
    status: text("status").notNull(),
    shares: jsonb("shares").$type<ItemShare[]>().notNull(),
    timeline: jsonb("timeline").$type<Partial<Record<ItemStatus, string>>>().notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("order_items_session").on(table.sessionId)],
);

export const waiterCalls = pgTable(
  "waiter_calls",
  {
    id: text("id").primaryKey(),
    n: bigserial("n", { mode: "number" }).notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => tableSessions.id),
    tabId: text("tab_id"),
    reason: text("reason").notNull(),
    message: text("message"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("waiter_calls_session").on(table.sessionId)],
);

/** Registro de mudanças: as telas consultam os eventos depois do último `seq` que viram. */
export const events = pgTable("events", {
  seq: bigserial("seq", { mode: "number" }).primaryKey(),
  type: text("type").notNull(),
  at: text("at").notNull(),
  actor: text("actor").notNull(),
  sessionId: text("session_id"),
  entityId: text("entity_id").notNull(),
});
