import { DEMO_STAFF, MAP_SPOTS, MENU_CATEGORIES, MENU_ITEMS, RESTAURANT, TABLES } from "@/lib/seed-data";
import { defaultStaffPinKey, type StaffPinKey } from "@/lib/staff-pin";
import { createStore, type EngineOptions } from "@/lib/store/engine";
import type { Restaurant, StaffMember } from "@/types/domain";
import type { Repository, SessionChanges, SessionRecord, StaffGuard, Store, StoreEvent } from "@/types/store";

/** Troca as linhas com o mesmo id e acrescenta as novas no fim, mantendo a ordem de criação. */
const upsert = <T extends { id: string }>(list: T[], rows: T[] | undefined): T[] => {
  if (!rows?.length) return list;
  const next = [...list];
  for (const row of rows) {
    const index = next.findIndex((entry) => entry.id === row.id);
    if (index === -1) next.push(row);
    else next[index] = row;
  }
  return next;
};

const apply = (record: SessionRecord, changes: SessionChanges): SessionRecord => ({
  session: changes.session ?? record.session,
  secret: changes.secret ?? record.secret,
  tabs: upsert(record.tabs, changes.tabs),
  orders: upsert(record.orders, changes.orders),
  items: upsert(record.items, changes.items),
  calls: upsert(record.calls, changes.calls),
  version: record.version + 1,
});

/**
 * Repositório em memória: um processo só (`pnpm dev`, `pnpm start`, CI e E2E).
 * Os dados somem quando o processo reinicia. Tudo sai como cópia, para ninguém mexer por fora.
 */
export const createMemoryRepository = ({ pinKey = defaultStaffPinKey() }: { pinKey?: StaffPinKey } = {}): Repository => {
  let restaurant: Restaurant = structuredClone(RESTAURANT);
  const tables = structuredClone(TABLES);
  const mapSpots = structuredClone(MAP_SPOTS);
  const categories = structuredClone(MENU_CATEGORIES);
  let menuItems = structuredClone(MENU_ITEMS);
  const sessions = new Map<string, SessionRecord>();
  const events: StoreEvent[] = [];
  // Equipe: a pessoa e a chave do PIN dela (nunca o PIN).
  let staff: { member: StaffMember; pinKey: string }[] = DEMO_STAFF.map(({ pin, ...member }) => ({
    member,
    pinKey: pinKey(member.restaurantId, pin),
  }));
  let guard: StaffGuard = { failedAttempts: 0 };

  const push = (event: Omit<StoreEvent, "seq">) => {
    events.push({ ...event, seq: events.length + 1 });
  };

  return {
    async getRestaurant() {
      return structuredClone(restaurant);
    },
    async saveRestaurant(next, event) {
      restaurant = structuredClone(next);
      push(event);
    },
    async listTables() {
      return structuredClone(tables);
    },
    async listMapSpots() {
      return structuredClone(mapSpots);
    },
    async getMenu() {
      return structuredClone({ categories, items: menuItems });
    },
    async saveMenuItem(item, event) {
      menuItems = upsert(menuItems, [structuredClone(item)]);
      push(event);
    },

    async findSessionId(ref) {
      for (const record of sessions.values()) {
        if ("openAtTable" in ref) {
          if (record.session.tableId === ref.openAtTable && record.session.status === "open") return record.session.id;
        } else if ("tabId" in ref) {
          if (record.tabs.some((tab) => tab.id === ref.tabId)) return record.session.id;
        } else if ("itemId" in ref) {
          if (record.items.some((item) => item.id === ref.itemId)) return record.session.id;
        } else if (record.calls.some((call) => call.id === ref.callId)) {
          return record.session.id;
        }
      }
      return null;
    },

    async loadSession(sessionId) {
      const record = sessions.get(sessionId);
      return record ? structuredClone(record) : null;
    },

    async listSessions({ since }) {
      const sinceMs = since ? Date.parse(since) : Number.POSITIVE_INFINITY;
      return structuredClone(
        [...sessions.values()].filter(
          (record) => record.session.status === "open" || Date.parse(record.session.openedAt) >= sinceMs,
        ),
      );
    },

    async insertSession(record, event) {
      const busy = [...sessions.values()].some(
        (entry) => entry.session.tableId === record.session.tableId && entry.session.status === "open",
      );
      if (busy) return false;
      sessions.set(record.session.id, { ...structuredClone(record), version: 1 });
      push(event);
      return true;
    },

    async saveSession(sessionId, expectedVersion, changes, event) {
      const record = sessions.get(sessionId);
      // Tudo aqui é síncrono: ler a versão, aplicar e gravar acontece sem nada no meio.
      if (!record || record.version !== expectedVersion) return false;
      sessions.set(sessionId, apply(record, structuredClone(changes)));
      if (event) push(event);
      return true;
    },

    async getEvents(afterSeq, sessionId) {
      const after = events.slice(afterSeq);
      return {
        events: structuredClone(
          sessionId === undefined
            ? after
            : // Eventos sem mesa (cardápio, configuração) valem para todas.
              after.filter((event) => event.sessionId === sessionId || event.sessionId === undefined),
        ),
        lastSeq: events.length,
      };
    },

    async listStaff() {
      return structuredClone(staff.map((entry) => entry.member));
    },

    async findStaffByPinKey(key) {
      const found = staff.find((entry) => entry.pinKey === key);
      return found ? structuredClone(found.member) : null;
    },

    async findStaffById(staffId) {
      const found = staff.find((entry) => entry.member.id === staffId);
      return found ? structuredClone(found.member) : null;
    },

    async insertStaff(member, key, event) {
      if (staff.some((entry) => entry.pinKey === key)) return false;
      staff = [...staff, { member: structuredClone(member), pinKey: key }];
      push(event);
      return true;
    },

    async updateStaff(member, key, event) {
      if (key !== null && staff.some((entry) => entry.pinKey === key && entry.member.id !== member.id)) return false;
      staff = staff.map((entry) =>
        entry.member.id === member.id ? { member: structuredClone(member), pinKey: key ?? entry.pinKey } : entry,
      );
      push(event);
      return true;
    },

    async getStaffGuard() {
      return structuredClone(guard);
    },

    async saveStaffGuard(next) {
      guard = structuredClone(next);
    },
  };
};

/** Store completo sobre o repositório em memória. */
export const createMemoryStore = (options: EngineOptions = {}): Store =>
  createStore(createMemoryRepository({ pinKey: options.pinKey }), options);
