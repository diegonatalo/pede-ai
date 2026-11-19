import { roleOf, staffIdOf } from "@/lib/actor";
import { isStaffRole } from "@/lib/api/identity";
import { validateShares } from "@/lib/billing";
import { defaultStaffPinKey, generateStaffPin, isStaffPin, type StaffPinKey } from "@/lib/staff-pin";
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
  Actor,
  MenuItem,
  Order,
  OrderItem,
  Role,
  StaffMember,
  Tab,
  Table,
  TableSession,
  WaiterCall,
} from "@/types/domain";
import type {
  EventType,
  NewEvent,
  Repository,
  Result,
  SessionChanges,
  SessionRecord,
  SessionSnapshot,
  Store,
  StoreError,
} from "@/types/store";

export type EngineOptions = {
  /** Relógio injetável, para os testes. */
  now?: () => Date;
  newId?: () => string;
  /** PIN novo da equipe (injetável nos testes). */
  newPin?: () => string;
  /** Chave guardada no lugar do PIN; precisa ser a mesma do repositório (ver `lib/staff-pin.ts`). */
  pinKey?: StaffPinKey;
};

/** Quantas vezes um comando relê a mesa e tenta de novo quando outra pessoa gravou antes. */
const MAX_ATTEMPTS = 3;

/** Erros seguidos de PIN da equipe antes de bloquear o login, e por quanto tempo. */
const STAFF_PIN_ATTEMPTS = 20;
const STAFF_PIN_LOCK_MS = 2 * 60_000;

/** Quantos PINs sortear antes de desistir quando o sorteado já é de outra pessoa. */
const PIN_DRAWS = 8;

const ok = <T>(value: T): Result<T> => ({ ok: true, value: structuredClone(value) });
const fail = <T>(error: StoreError): Result<T> => ({ ok: false, error });
const can = (actor: Actor, allowed: readonly Role[]) => allowed.includes(roleOf(actor));

/** Resultado de um comando sobre a mesa: o que devolver e, se deu certo, o que gravar. */
type Outcome<T> =
  | { result: Result<T> }
  | { result: Result<T>; changes: SessionChanges; event: NewEvent | null };

/**
 * As regras do store, iguais para qualquer repositório. Cada comando lê a mesa inteira,
 * decide com as funções puras de `lib/` e grava só o que mudou, com controle de versão:
 * se outra pessoa gravou a mesma mesa no meio do caminho, lê de novo e repete.
 */
export const createStore = (
  repo: Repository,
  {
    now = () => new Date(),
    newId = () => crypto.randomUUID(),
    newPin = () => generateStaffPin(),
    pinKey = defaultStaffPinKey(),
  }: EngineOptions = {},
): Store => {
  const iso = () => now().toISOString();
  const event = (type: EventType, actor: Actor, entityId: string, sessionId?: string): NewEvent => {
    const actorStaffId = staffIdOf(actor);
    return {
      type,
      at: iso(),
      actor: roleOf(actor),
      ...(actorStaffId !== undefined && { actorStaffId }),
      entityId,
      ...(sessionId !== undefined && { sessionId }),
    };
  };

  const snapshot = (record: SessionRecord, tables: Table[]): SessionSnapshot => {
    const table = tables.find((entry) => entry.id === record.session.tableId);
    if (!table) throw new Error(`mesa ${record.session.tableId} não existe`);
    const { session, tabs, orders, items, calls } = record;
    return { session, table, tabs, orders, items, calls };
  };

  /** Lê a mesa, aplica `decide` e grava; repete se outra gravação chegou antes. */
  const mutate = async <T>(
    sessionId: string | null,
    decide: (record: SessionRecord) => Outcome<T>,
  ): Promise<Result<T>> => {
    if (!sessionId) return fail("not_found");
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const record = await repo.loadSession(sessionId);
      if (!record) return fail("not_found");
      const outcome = decide(record);
      if (!("changes" in outcome)) return outcome.result;
      if (await repo.saveSession(sessionId, record.version, outcome.changes, outcome.event)) return outcome.result;
    }
    return fail("conflict");
  };

  const requireOpen = (record: SessionRecord) => record.session.status === "open";

  return {
    getRestaurant: () => repo.getRestaurant(),

    async updateRestaurant(settings, actor) {
      if (roleOf(actor) !== "manager") return fail("forbidden");
      const { serviceFeePercent, couvertCents, requireFirstOrderApproval } = settings;
      if (serviceFeePercent !== undefined && !isIntInRange(serviceFeePercent, 0, LIMITS.serviceFeePercent))
        return fail("invalid_input");
      if (couvertCents !== undefined && !isIntInRange(couvertCents, 0, LIMITS.couvertCents))
        return fail("invalid_input");
      if (requireFirstOrderApproval !== undefined && typeof requireFirstOrderApproval !== "boolean")
        return fail("invalid_input");
      const current = await repo.getRestaurant();
      const restaurant = {
        ...current,
        ...(serviceFeePercent !== undefined && { serviceFeePercent }),
        ...(couvertCents !== undefined && { couvertCents }),
        ...(requireFirstOrderApproval !== undefined && { requireFirstOrderApproval }),
      };
      await repo.saveRestaurant(restaurant, event("restaurant_updated", actor, restaurant.id));
      return ok(restaurant);
    },

    listTables: () => repo.listTables(),
    listMapSpots: () => repo.listMapSpots(),
    getMenu: () => repo.getMenu(),

    async setItemAvailability(menuItemId, available, actor) {
      if (!can(actor, ["kitchen", "manager"])) return fail("forbidden");
      const menuItem = (await repo.getMenu()).items.find((item) => item.id === menuItemId);
      if (!menuItem) return fail("not_found");
      if (typeof available !== "boolean") return fail("invalid_input");
      const updated: MenuItem = { ...menuItem, available };
      await repo.saveMenuItem(updated, event("item_availability_changed", actor, menuItemId));
      return ok(updated);
    },

    async openSession(tableId, joinCode, actor) {
      if (!can(actor, STAFF)) return fail("forbidden");
      if (!(await repo.listTables()).some((table) => table.id === tableId)) return fail("not_found");
      if (!isJoinCode(joinCode)) return fail("invalid_input");
      const restaurant = await repo.getRestaurant();
      const session: TableSession = {
        id: newId(),
        restaurantId: restaurant.id,
        tableId,
        status: "open",
        openedAt: iso(),
      };
      const created = await repo.insertSession(
        { session, secret: { joinCode, failedAttempts: 0 }, tabs: [], orders: [], items: [], calls: [] },
        event("session_opened", actor, session.id, session.id),
      );
      return created ? ok(session) : fail("already_open");
    },

    async getJoinCode(sessionId, actor) {
      if (!can(actor, STAFF)) return fail("forbidden");
      const record = await repo.loadSession(sessionId);
      return record && requireOpen(record) ? ok(record.secret.joinCode) : fail("not_found");
    },

    verifyJoinCode: (sessionId, code) =>
      mutate(sessionId, (record) => {
        if (!requireOpen(record)) return { result: fail("session_closed") };
        const { secret } = record;
        const time = now().getTime();
        if (secret.lockedUntil !== undefined && secret.lockedUntil > time) return { result: fail("locked") };
        if (code === secret.joinCode) {
          // Acerto zera os erros; só grava se havia algo a zerar.
          if (secret.failedAttempts === 0 && secret.lockedUntil === undefined) return { result: ok(true as const) };
          return { result: ok(true as const), changes: { secret: { joinCode: secret.joinCode, failedAttempts: 0 } }, event: null };
        }
        const failedAttempts = secret.failedAttempts + 1;
        if (failedAttempts >= LIMITS.joinAttempts) {
          return {
            result: fail("locked"),
            changes: { secret: { joinCode: secret.joinCode, failedAttempts: 0, lockedUntil: time + LIMITS.joinLockMinutes * 60_000 } },
            event: null,
          };
        }
        return { result: fail("wrong_code"), changes: { secret: { ...secret, failedAttempts } }, event: null };
      }),

    async getOpenSessionByTable(tableId) {
      const id = await repo.findSessionId({ openAtTable: tableId });
      const record = id ? await repo.loadSession(id) : null;
      return record ? structuredClone(record.session) : null;
    },

    async getSessionSnapshot(sessionId) {
      const record = await repo.loadSession(sessionId);
      return record ? ok(snapshot(record, await repo.listTables())) : fail("not_found");
    },

    async listOpenSessions() {
      const [records, tables] = await Promise.all([repo.listSessions({}), repo.listTables()]);
      return structuredClone(records.filter(requireOpen).map((record) => snapshot(record, tables)));
    },

    async listSessionsSince(since, actor) {
      if (roleOf(actor) !== "manager") return fail("forbidden");
      if (Number.isNaN(Date.parse(since))) return fail("invalid_input");
      const [records, tables] = await Promise.all([repo.listSessions({ since }), repo.listTables()]);
      return ok(records.map((record) => snapshot(record, tables)));
    },

    async closeSession(sessionId, actor) {
      if (!can(actor, STAFF)) return fail("forbidden");
      return mutate(sessionId, (record) => {
        if (!requireOpen(record)) return { result: fail("session_closed") };
        if (!canCloseSession(record.tabs)) return { result: fail("cannot_close") };
        const closed: TableSession = { ...record.session, status: "closed", closedAt: iso() };
        return { result: ok(closed), changes: { session: closed }, event: event("session_closed", actor, sessionId, sessionId) };
      });
    },

    async createTab(input, actor) {
      if (!can(actor, ["customer", ...STAFF])) return fail("forbidden");
      const restaurant = await repo.getRestaurant();
      return mutate(input.sessionId, (record) => {
        if (!requireOpen(record)) return { result: fail("session_closed") };
        const customerName = cleanText(input.customerName, LIMITS.customerName);
        if (!customerName || !isIntInRange(input.peopleCount, 1, LIMITS.peopleCount)) return { result: fail("invalid_input") };
        const tab: Tab = {
          id: newId(),
          sessionId: record.session.id,
          customerName,
          peopleCount: input.peopleCount,
          status: "open",
          // Comanda aberta pela equipe já nasce confirmada.
          approved: !restaurant.requireFirstOrderApproval || can(actor, STAFF),
          createdAt: iso(),
        };
        return { result: ok(tab), changes: { tabs: [tab] }, event: event("tab_created", actor, tab.id, record.session.id) };
      });
    },

    async approveTab(tabId, actor) {
      if (!can(actor, STAFF)) return fail("forbidden");
      return mutate(await repo.findSessionId({ tabId }), (record) => {
        const tab = record.tabs.find((entry) => entry.id === tabId);
        if (!tab) return { result: fail("not_found") };
        if (!requireOpen(record)) return { result: fail("session_closed") };
        const approved: Tab = { ...tab, approved: true };
        const at = iso();
        const tabOrderIds = new Set(record.orders.filter((order) => order.tabId === tabId).map((order) => order.id));
        const released: OrderItem[] = record.items
          .filter((item) => tabOrderIds.has(item.orderId) && item.status === "awaiting_approval")
          .map((item) => ({ ...item, status: "sent", updatedAt: at, timeline: { ...item.timeline, sent: at } }));
        return {
          result: ok(approved),
          changes: { tabs: [approved], items: released },
          event: event("tab_approved", actor, tabId, record.session.id),
        };
      });
    },

    async setTabStatus(tabId, to, actor) {
      return mutate(await repo.findSessionId({ tabId }), (record) => {
        const tab = record.tabs.find((entry) => entry.id === tabId);
        if (!tab) return { result: fail("not_found") };
        if (!requireOpen(record)) return { result: fail("session_closed") };
        const check = checkTabTransition(tab.status, to, roleOf(actor));
        if (!check.ok) return { result: fail(check.error) };
        const updated: Tab = { ...tab, status: to };
        return { result: ok(updated), changes: { tabs: [updated] }, event: event("tab_status_changed", actor, tabId, record.session.id) };
      });
    },

    async placeOrder(input, actor) {
      if (!can(actor, ["customer", ...STAFF])) return fail("forbidden");
      const [restaurant, menu] = await Promise.all([repo.getRestaurant(), repo.getMenu()]);
      const menuItems = new Map(menu.items.map((item) => [item.id, item]));

      return mutate(await repo.findSessionId({ tabId: input.tabId }), (record) => {
        const tab = record.tabs.find((entry) => entry.id === input.tabId);
        if (!tab) return { result: fail("not_found") };
        if (!requireOpen(record)) return { result: fail("session_closed") };
        if (!canOrder(tab)) return { result: fail("tab_closed") };
        if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > LIMITS.linesPerOrder)
          return { result: fail("invalid_input") };

        const lines: { menuItem: MenuItem; quantity: number; note?: string }[] = [];
        for (const line of input.lines) {
          const menuItem = menuItems.get(line.menuItemId);
          if (!menuItem) return { result: fail("not_found") };
          if (!menuItem.available) return { result: fail("item_unavailable") };
          const note = cleanOptionalText(line.note, LIMITS.note);
          if (!isIntInRange(line.quantity, 1, LIMITS.quantity) || note === null) return { result: fail("invalid_input") };
          lines.push({ menuItem, quantity: line.quantity, note });
        }

        const at = iso();
        const order: Order = { id: newId(), sessionId: record.session.id, tabId: tab.id, createdAt: at };
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
          timeline: { [status]: at },
        }));
        return {
          result: ok({ order, items: created }),
          changes: { orders: [order], items: created },
          event: event("order_placed", actor, order.id, record.session.id),
        };
      });
    },

    async setItemStatus(itemId, to, actor) {
      return mutate(await repo.findSessionId({ itemId }), (record) => {
        const item = record.items.find((entry) => entry.id === itemId);
        if (!item) return { result: fail("not_found") };
        if (!requireOpen(record)) return { result: fail("session_closed") };
        const check = checkItemTransition(item.status, to, roleOf(actor));
        if (!check.ok) return { result: fail(check.error) };
        const at = iso();
        const updated: OrderItem = { ...item, status: to, updatedAt: at, timeline: { ...item.timeline, [to]: at } };
        return { result: ok(updated), changes: { items: [updated] }, event: event("item_status_changed", actor, itemId, record.session.id) };
      });
    },

    async setItemShares(itemId, shares, actor) {
      if (!can(actor, ["customer", ...STAFF])) return fail("forbidden");
      return mutate(await repo.findSessionId({ itemId }), (record) => {
        const item = record.items.find((entry) => entry.id === itemId);
        if (!item) return { result: fail("not_found") };
        if (!requireOpen(record)) return { result: fail("session_closed") };
        if (item.status === "canceled") return { result: fail("invalid_transition") };
        const openTabIds = record.tabs
          .filter((tab) => tab.status === "open" || tab.status === "bill_requested")
          .map((tab) => tab.id);
        const error = validateShares(shares, openTabIds);
        if (error) return { result: fail(error) };
        const updated: OrderItem = {
          ...item,
          shares: shares.map(({ tabId, parts }) => ({ tabId, parts })),
          updatedAt: iso(),
        };
        return { result: ok(updated), changes: { items: [updated] }, event: event("item_shares_changed", actor, itemId, record.session.id) };
      });
    },

    async createCall(input, actor) {
      if (!can(actor, ["customer", ...STAFF])) return fail("forbidden");
      return mutate(input.sessionId, (record) => {
        if (!requireOpen(record)) return { result: fail("session_closed") };
        if (input.tabId !== undefined && !record.tabs.some((tab) => tab.id === input.tabId)) return { result: fail("not_found") };
        if (!["question", "bill", "other"].includes(input.reason)) return { result: fail("invalid_input") };
        const message = cleanOptionalText(input.message, LIMITS.callMessage);
        if (message === null) return { result: fail("invalid_input") };
        const call: WaiterCall = {
          id: newId(),
          sessionId: record.session.id,
          ...(input.tabId !== undefined && { tabId: input.tabId }),
          reason: input.reason,
          ...(message !== undefined && { message }),
          status: "open",
          createdAt: iso(),
        };
        return { result: ok(call), changes: { calls: [call] }, event: event("call_created", actor, call.id, record.session.id) };
      });
    },

    async setCallStatus(callId, to, actor) {
      return mutate(await repo.findSessionId({ callId }), (record) => {
        const call = record.calls.find((entry) => entry.id === callId);
        if (!call) return { result: fail("not_found") };
        const check = checkCallTransition(call.status, to, roleOf(actor));
        if (!check.ok) return { result: fail(check.error) };
        const updated: WaiterCall = { ...call, status: to };
        return { result: ok(updated), changes: { calls: [updated] }, event: event("call_status_changed", actor, callId, record.session.id) };
      });
    },

    async listStaff(actor) {
      if (roleOf(actor) !== "manager") return fail("forbidden");
      return ok(await repo.listStaff());
    },

    async createStaff(input, actor) {
      if (roleOf(actor) !== "manager") return fail("forbidden");
      const name = cleanText(input.name, LIMITS.customerName);
      if (!name || !isStaffRole(input.role)) return fail("invalid_input");
      const restaurant = await repo.getRestaurant();
      const member: StaffMember = {
        id: newId(),
        restaurantId: restaurant.id,
        name,
        role: input.role,
        active: true,
        system: false,
        createdAt: iso(),
      };
      // O PIN sorteado pode já ser de outra pessoa do restaurante: sorteia de novo.
      for (let draw = 0; draw < PIN_DRAWS; draw += 1) {
        const pin = newPin();
        if (await repo.insertStaff(member, pinKey(restaurant.id, pin), event("staff_created", actor, member.id))) {
          return ok({ member, pin });
        }
      }
      return fail("conflict");
    },

    async resetStaffPin(staffId, actor) {
      if (roleOf(actor) !== "manager") return fail("forbidden");
      const member = (await repo.listStaff()).find((entry) => entry.id === staffId);
      if (!member) return fail("not_found");
      if (member.system) return fail("forbidden");
      for (let draw = 0; draw < PIN_DRAWS; draw += 1) {
        const pin = newPin();
        if (await repo.updateStaff(member, pinKey(member.restaurantId, pin), event("staff_updated", actor, member.id))) {
          return ok({ member, pin });
        }
      }
      return fail("conflict");
    },

    async setStaffActive(staffId, active, actor) {
      if (roleOf(actor) !== "manager") return fail("forbidden");
      if (typeof active !== "boolean") return fail("invalid_input");
      const member = (await repo.listStaff()).find((entry) => entry.id === staffId);
      if (!member) return fail("not_found");
      // Pessoas da demonstração não podem ser desativadas: a demo pública quebraria para todo mundo.
      if (member.system) return fail("forbidden");
      // Quem está usando a tela não desativa a si mesmo (ficaria sem acesso no meio do trabalho).
      if (!active && staffIdOf(actor) === staffId) return fail("forbidden");
      const updated: StaffMember = { ...member, active };
      await repo.updateStaff(updated, null, event("staff_updated", actor, member.id));
      return ok(updated);
    },

    getStaffMember: (staffId) => repo.findStaffById(staffId),

    async verifyStaffPin(pin) {
      if (!isStaffPin(pin)) return fail("wrong_pin");
      const guard = await repo.getStaffGuard();
      const time = now().getTime();
      if (guard.lockedUntil !== undefined && guard.lockedUntil > time) return fail("locked");
      const restaurant = await repo.getRestaurant();
      const member = await repo.findStaffByPinKey(pinKey(restaurant.id, pin));
      if (member?.active) {
        if (guard.failedAttempts > 0 || guard.lockedUntil !== undefined) await repo.saveStaffGuard({ failedAttempts: 0 });
        return ok(member);
      }
      const failedAttempts = guard.failedAttempts + 1;
      if (failedAttempts >= STAFF_PIN_ATTEMPTS) {
        await repo.saveStaffGuard({ failedAttempts: 0, lockedUntil: time + STAFF_PIN_LOCK_MS });
        return fail("locked");
      }
      await repo.saveStaffGuard({ failedAttempts });
      return fail("wrong_pin");
    },

    async getEvents(afterSeq, sessionId) {
      return structuredClone(await repo.getEvents(Math.max(0, Number.isFinite(afterSeq) ? afterSeq : 0), sessionId));
    },
  };
};
