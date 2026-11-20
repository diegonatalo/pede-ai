import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { ItemShare, ItemStatus } from "@/types/domain";

/**
 * Banco do pede-ai (Postgres no Neon). Datas em texto ISO 8601 (UTC), como no domínio;
 * dinheiro em centavos inteiros. `n` (bigserial) só guarda a ordem de criação das linhas.
 * Toda tabela leva `restaurant_id` (direto ou pela sessão), pensando em vários restaurantes.
 */

export const restaurants = pgTable("restaurants", {
  id: text("id").primaryKey(),
  /** Endereço do restaurante (`/r/<slug>`), único. */
  slug: text("slug").notNull().unique(),
  /** Conta (Better Auth) dona do restaurante; nulo só no restaurante de exemplo dos testes. */
  ownerUserId: text("owner_user_id"),
  name: text("name").notNull(),
  serviceFeePercent: integer("service_fee_percent").notNull(),
  couvertCents: integer("couvert_cents").notNull(),
  requireFirstOrderApproval: boolean("require_first_order_approval").notNull(),
  // Erros seguidos de PIN da equipe, para bloquear tentativas em série.
  staffFailedAttempts: integer("staff_failed_attempts").notNull().default(0),
  staffLockedUntil: bigint("staff_locked_until", { mode: "number" }),
});

/**
 * Pessoas da equipe. `pin_key` é um HMAC do PIN com a chave do app (ver lib/staff-pin.ts):
 * acha a pessoa numa consulta e impede PIN repetido no restaurante, sem guardar o PIN.
 */
export const staffMembers = pgTable(
  "staff_members",
  {
    id: text("id").primaryKey(),
    n: bigserial("n", { mode: "number" }).notNull(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    name: text("name").notNull(),
    role: text("role").notNull(),
    pinKey: text("pin_key").notNull(),
    active: boolean("active").notNull(),
    system: boolean("system").notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("staff_members_pin_per_restaurant").on(table.restaurantId, table.pinKey)],
);

export const diningTables = pgTable("dining_tables", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  label: text("label").notNull(),
  /** Mesa fora do salão: não aparece nas telas, mas fica para as sessões antigas. */
  archived: boolean("archived").notNull().default(false),
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
export const events = pgTable(
  "events",
  {
  seq: bigserial("seq", { mode: "number" }).primaryKey(),
  restaurantId: text("restaurant_id").notNull(),
  type: text("type").notNull(),
  at: text("at").notNull(),
  actor: text("actor").notNull(),
  actorStaffId: text("actor_staff_id"),
  sessionId: text("session_id"),
  entityId: text("entity_id").notNull(),
  },
  // O feed de cada restaurante lê os eventos dele depois de um seq.
  (table) => [index("events_restaurant_seq").on(table.restaurantId, table.seq)],
);

// --- Login das contas (Better Auth) ---
// Nomes das colunas iguais aos campos que o Better Auth espera (user, session, account, verification);
// as tabelas ficam com o prefixo auth_ para não se misturar com as do restaurante.

export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [index("auth_sessions_user").on(table.userId)],
);

/** Cada forma de entrar de uma conta. Com e-mail e senha, a senha fica aqui, só como hash. */
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("auth_accounts_user").on(table.userId)],
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("auth_verifications_identifier").on(table.identifier)],
);

/**
 * Falhas por chave numa janela de tempo (ex.: códigos de mesa errados por endereço de internet).
 * A chave é um HMAC do endereço, nunca o endereço (ver lib/rate-limit.ts).
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: bigint("window_start", { mode: "number" }).notNull(),
});

/**
 * Aparelhos da equipe inscritos para receber avisos (Web Push). O endereço de envio é único por
 * aparelho; as chaves servem para criptografar o aviso, que só aquele aparelho consegue abrir.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    endpoint: text("endpoint").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    staffId: text("staff_id").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("push_subscriptions_restaurant").on(table.restaurantId)],
);
