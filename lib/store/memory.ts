import { validateShares } from "@/lib/billing";
import { MAP_SPOTS, MENU_CATEGORIES, MENU_ITEMS, RESTAURANT, TABLES } from "@/lib/seed-data";
import {
  LIMITS,
  STAFF,
  cleanOptionalText,
  cleanText,
  isIntInRange,
  isJoinCode,
} from "@/lib/store/input";
import {
  canCloseSession,
  canOrder,
  checkCallTransition,
  checkItemTransition,
  checkTabTransition,
  initialItemStatus,
} from "@/lib/transitions";
import type {
  MenuItem,
  Order,
  OrderItem,
  Restaurant,
  Role,
  Tab,
  TableSession,
  WaiterCall,
} from "@/types/domain";
import type {
  EventType,
  Result,
  SessionSnapshot,
  Store,
  StoreError,
  StoreEvent,
} from "@/types/store";

type Options = {
  /** Relógio injetável, para os testes. */
  now?: () => Date;
  newId?: () => string;
};

type SessionSecret = { joinCode: string; failedAttempts: number; lockedUntil?: number };

const ok = <T>(value: T): Result<T> => ({ ok: true, value: structuredClone(value) });
const fail = <T>(error: StoreError): Result<T> => ({ ok: false, error });
const can = (role: Role, allowed: readonly Role[]) => allowed.includes(role);

/**
 * Adaptador em memória: um processo só (`pnpm dev`, `pnpm start`, CI e E2E).
 * Os dados somem quando o processo reinicia. Na Vercel, use o adaptador do Postgres.
 */
export const createMemoryStore = ({
  now = () => new Date(),
  newId = () => crypto.randomUUID(),
}: Options = {}): Store => {
  let restaurant: Restaurant = structuredClone(RESTAURANT);
  const tables = structuredClone(TABLES);
  const mapSpots = structuredClone(MAP_SPOTS);
  const categories = structuredClone(MENU_CATEGORIES);
  const menuItems = new Map(structuredClone(MENU_ITEMS).map((item) => [item.id, item]));

  const sessions = new Map<string, TableSession>();
  const secrets = new Map<string, SessionSecret>();
  const tabs = new Map<string, Tab>();
  const orders = new Map<string, Order>();
  const items = new Map<string, OrderItem>();
  const calls = new Map<string, WaiterCall>();
  const events: StoreEvent[] = [];

  const iso = () => now().toISOString();

  const record = (type: EventType, actor: Role, entityId: string, sessionId?: string) => {
    events.push({ seq: events.length + 1, type, at: iso(), actor, entityId, sessionId });
  };

  const sessionOfTab = (tab: Tab) => sessions.get(tab.sessionId);
  const sessionOfItem = (item: OrderItem) => {
    const order = orders.get(item.orderId);
    return order ? sessions.get(order.sessionId) : undefined;
  };

  const snapshot = (session: TableSession): SessionSnapshot => {
    const table = tables.find((entry) => entry.id === session.tableId);
    if (!table) throw new Error(`mesa ${session.tableId} não existe`);
    const sessionOrders = [...orders.values()].filter((order) => order.sessionId === session.id);
    const orderIds = new Set(sessionOrders.map((order) => order.id));
    return {
      session,
      table,
      tabs: [...tabs.values()].filter((tab) => tab.sessionId === session.id),
      orders: sessionOrders,
      items: [...items.values()].filter((item) => orderIds.has(item.orderId)),
      calls: [...calls.values()].filter((call) => call.sessionId === session.id),
    };
  };

  return {
    async getRestaurant() {
      return structuredClone(restaurant);
    },

    async updateRestaurant(settings, actor) {
      if (actor !== "manager") return fail("forbidden");
      const { serviceFeePercent, couvertCents, requireFirstOrderApproval } = settings;
      if (serviceFeePercent !== undefined && !isIntInRange(serviceFeePercent, 0, LIMITS.serviceFeePercent))
        return fail("invalid_input");
      if (couvertCents !== undefined && !isIntInRange(couvertCents, 0, LIMITS.couvertCents))
        return fail("invalid_input");
      if (requireFirstOrderApproval !== undefined && typeof requireFirstOrderApproval !== "boolean")
        return fail("invalid_input");
      restaurant = {
        ...restaurant,
        ...(serviceFeePercent !== undefined && { serviceFeePercent }),
        ...(couvertCents !== undefined && { couvertCents }),
        ...(requireFirstOrderApproval !== undefined && { requireFirstOrderApproval }),
      };
      record("restaurant_updated", actor, restaurant.id);
      return ok(restaurant);
    },

    async listTables() {
      return structuredClone(tables);
    },

    async listMapSpots() {
      return structuredClone(mapSpots);
    },

    async getMenu() {
      return structuredClone({ categories, items: [...menuItems.values()] });
    },

    async setItemAvailability(menuItemId, available, actor) {
      if (!can(actor, ["kitchen", "manager"])) return fail("forbidden");
      const menuItem = menuItems.get(menuItemId);
      if (!menuItem) return fail("not_found");
      if (typeof available !== "boolean") return fail("invalid_input");
      const updated: MenuItem = { ...menuItem, available };
      menuItems.set(menuItemId, updated);
      record("item_availability_changed", actor, menuItemId);
      return ok(updated);
    },

    async openSession(tableId, joinCode, actor) {
      if (!can(actor, STAFF)) return fail("forbidden");
      if (!tables.some((table) => table.id === tableId)) return fail("not_found");
      if (!isJoinCode(joinCode)) return fail("invalid_input");
      if ([...sessions.values()].some((s) => s.tableId === tableId && s.status === "open"))
        return fail("already_open");
      const session: TableSession = {
        id: newId(),
        restaurantId: restaurant.id,
        tableId,
        status: "open",
        openedAt: iso(),
      };
      sessions.set(session.id, session);
      secrets.set(session.id, { joinCode, failedAttempts: 0 });
      record("session_opened", actor, session.id, session.id);
      return ok(session);
    },

    async getJoinCode(sessionId, actor) {
      if (!can(actor, STAFF)) return fail("forbidden");
      const secret = secrets.get(sessionId);
      return secret ? ok(secret.joinCode) : fail("not_found");
    },

    async verifyJoinCode(sessionId, code) {
      const session = sessions.get(sessionId);
      if (!session) return fail("not_found");
      if (session.status !== "open") return fail("session_closed");
      const secret = secrets.get(sessionId);
      if (!secret) return fail("not_found");
      const time = now().getTime();
      if (secret.lockedUntil !== undefined && secret.lockedUntil > time) return fail("locked");
      if (code === secret.joinCode) {
        secret.failedAttempts = 0;
        secret.lockedUntil = undefined;
        return ok(true as const);
      }
      secret.failedAttempts += 1;
      if (secret.failedAttempts >= LIMITS.joinAttempts) {
        secret.failedAttempts = 0;
        secret.lockedUntil = time + LIMITS.joinLockMinutes * 60_000;
        return fail("locked");
      }
      return fail("wrong_code");
    },

    async getOpenSessionByTable(tableId) {
      const session = [...sessions.values()].find((s) => s.tableId === tableId && s.status === "open");
      return session ? structuredClone(session) : null;
    },

    async getSessionSnapshot(sessionId) {
      const session = sessions.get(sessionId);
      return session ? ok(snapshot(session)) : fail("not_found");
    },

    async listOpenSessions() {
      return structuredClone(
        [...sessions.values()].filter((session) => session.status === "open").map(snapshot),
      );
    },

    async closeSession(sessionId, actor) {
      if (!can(actor, STAFF)) return fail("forbidden");
      const session = sessions.get(sessionId);
      if (!session) return fail("not_found");
      if (session.status !== "open") return fail("session_closed");
      if (!canCloseSession(snapshot(session).tabs)) return fail("cannot_close");
      const closed: TableSession = { ...session, status: "closed", closedAt: iso() };
      sessions.set(sessionId, closed);
      secrets.delete(sessionId);
      record("session_closed", actor, sessionId, sessionId);
      return ok(closed);
    },

    async createTab(input, actor) {
      if (!can(actor, ["customer", ...STAFF])) return fail("forbidden");
      const session = sessions.get(input.sessionId);
      if (!session) return fail("not_found");
      if (session.status !== "open") return fail("session_closed");
      const customerName = cleanText(input.customerName, LIMITS.customerName);
      if (!customerName || !isIntInRange(input.peopleCount, 1, LIMITS.peopleCount))
        return fail("invalid_input");
      const tab: Tab = {
        id: newId(),
        sessionId: session.id,
        customerName,
        peopleCount: input.peopleCount,
        status: "open",
        // Comanda aberta pela equipe já nasce confirmada.
        approved: !restaurant.requireFirstOrderApproval || can(actor, STAFF),
        createdAt: iso(),
      };
      tabs.set(tab.id, tab);
      record("tab_created", actor, tab.id, session.id);
      return ok(tab);
    },

    async approveTab(tabId, actor) {
      if (!can(actor, STAFF)) return fail("forbidden");
      const tab = tabs.get(tabId);
      if (!tab) return fail("not_found");
      if (sessionOfTab(tab)?.status !== "open") return fail("session_closed");
      const approved: Tab = { ...tab, approved: true };
      tabs.set(tabId, approved);
      const at = iso();
      const tabOrderIds = new Set(
        [...orders.values()].filter((order) => order.tabId === tabId).map((order) => order.id),
      );
      for (const item of items.values()) {
        if (tabOrderIds.has(item.orderId) && item.status === "awaiting_approval") {
          items.set(item.id, { ...item, status: "sent", updatedAt: at });
        }
      }
      record("tab_approved", actor, tabId, tab.sessionId);
      return ok(approved);
    },

    async setTabStatus(tabId, to, actor) {
      const tab = tabs.get(tabId);
      if (!tab) return fail("not_found");
      if (sessionOfTab(tab)?.status !== "open") return fail("session_closed");
      const check = checkTabTransition(tab.status, to, actor);
      if (!check.ok) return fail(check.error);
      const updated: Tab = { ...tab, status: to };
      tabs.set(tabId, updated);
      record("tab_status_changed", actor, tabId, tab.sessionId);
      return ok(updated);
    },

    async placeOrder(input, actor) {
      if (!can(actor, ["customer", ...STAFF])) return fail("forbidden");
      const tab = tabs.get(input.tabId);
      if (!tab) return fail("not_found");
      if (sessionOfTab(tab)?.status !== "open") return fail("session_closed");
      if (!canOrder(tab)) return fail("tab_closed");
      if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > LIMITS.linesPerOrder)
        return fail("invalid_input");

      const lines: { menuItem: MenuItem; quantity: number; note?: string }[] = [];
      for (const line of input.lines) {
        const menuItem = menuItems.get(line.menuItemId);
        if (!menuItem) return fail("not_found");
        if (!menuItem.available) return fail("item_unavailable");
        const note = cleanOptionalText(line.note, LIMITS.note);
        if (!isIntInRange(line.quantity, 1, LIMITS.quantity) || note === null) return fail("invalid_input");
        lines.push({ menuItem, quantity: line.quantity, note });
      }

      const at = iso();
      const order: Order = { id: newId(), sessionId: tab.sessionId, tabId: tab.id, createdAt: at };
      // Pedido lançado pela equipe não precisa da própria confirmação.
      const status = can(actor, STAFF) ? "sent" : initialItemStatus(restaurant, tab);
      const created: OrderItem[] = lines.map(({ menuItem, quantity, note }) => ({
        id: newId(),
        orderId: order.id,
        menuItemId: menuItem.id,
        nameSnapshot: menuItem.name,
        unitPriceCents: menuItem.priceCents,
        quantity,
        ...(note !== undefined && { note }),
        station: menuItem.station,
        status,
        shares: [{ tabId: tab.id, parts: 1 }],
        updatedAt: at,
      }));
      orders.set(order.id, order);
      for (const item of created) items.set(item.id, item);
      record("order_placed", actor, order.id, tab.sessionId);
      return ok({ order, items: created });
    },

    async setItemStatus(itemId, to, actor) {
      const item = items.get(itemId);
      if (!item) return fail("not_found");
      const session = sessionOfItem(item);
      if (session?.status !== "open") return fail("session_closed");
      const check = checkItemTransition(item.status, to, actor);
      if (!check.ok) return fail(check.error);
      const updated: OrderItem = { ...item, status: to, updatedAt: iso() };
      items.set(itemId, updated);
      record("item_status_changed", actor, itemId, session.id);
      return ok(updated);
    },

    async setItemShares(itemId, shares, actor) {
      if (!can(actor, ["customer", ...STAFF])) return fail("forbidden");
      const item = items.get(itemId);
      if (!item) return fail("not_found");
      const session = sessionOfItem(item);
      if (session?.status !== "open") return fail("session_closed");
      if (item.status === "canceled") return fail("invalid_transition");
      const openTabIds = snapshot(session)
        .tabs.filter((tab) => tab.status === "open" || tab.status === "bill_requested")
        .map((tab) => tab.id);
      const error = validateShares(shares, openTabIds);
      if (error) return fail(error);
      const updated: OrderItem = {
        ...item,
        shares: shares.map(({ tabId, parts }) => ({ tabId, parts })),
        updatedAt: iso(),
      };
      items.set(itemId, updated);
      record("item_shares_changed", actor, itemId, session.id);
      return ok(updated);
    },

    async createCall(input, actor) {
      if (!can(actor, ["customer", ...STAFF])) return fail("forbidden");
      const session = sessions.get(input.sessionId);
      if (!session) return fail("not_found");
      if (session.status !== "open") return fail("session_closed");
      if (input.tabId !== undefined && tabs.get(input.tabId)?.sessionId !== session.id)
        return fail("not_found");
      if (!["question", "bill", "other"].includes(input.reason)) return fail("invalid_input");
      const message = cleanOptionalText(input.message, LIMITS.callMessage);
      if (message === null) return fail("invalid_input");
      const call: WaiterCall = {
        id: newId(),
        sessionId: session.id,
        ...(input.tabId !== undefined && { tabId: input.tabId }),
        reason: input.reason,
        ...(message !== undefined && { message }),
        status: "open",
        createdAt: iso(),
      };
      calls.set(call.id, call);
      record("call_created", actor, call.id, session.id);
      return ok(call);
    },

    async setCallStatus(callId, to, actor) {
      const call = calls.get(callId);
      if (!call) return fail("not_found");
      const check = checkCallTransition(call.status, to, actor);
      if (!check.ok) return fail(check.error);
      const updated: WaiterCall = { ...call, status: to };
      calls.set(callId, updated);
      record("call_status_changed", actor, callId, call.sessionId);
      return ok(updated);
    },

    async getEvents(afterSeq, sessionId) {
      const after = events.slice(Math.max(0, afterSeq));
      return {
        events: structuredClone(
          sessionId === undefined ? after : after.filter((event) => event.sessionId === sessionId),
        ),
        lastSeq: events.length,
      };
    },
  };
};
