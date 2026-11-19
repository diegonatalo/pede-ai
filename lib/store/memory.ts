import { sampleRestaurantData, type RestaurantData } from "@/lib/restaurant-template";
import { RESTAURANT } from "@/lib/seed-data";
import { defaultStaffPinKey, type StaffPinKey } from "@/lib/staff-pin";
import { createStore, type EngineOptions } from "@/lib/store/engine";
import type { MapSpot, MenuCategory, MenuItem, Restaurant, StaffMember, Table } from "@/types/domain";
import type {
  Repository,
  RestaurantRegistry,
  SessionChanges,
  SessionRecord,
  StaffGuard,
  Store,
  StoreEvent,
} from "@/types/store";

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

/** Tudo de um restaurante na memória. Nada de um restaurante aparece no outro. */
type RestaurantState = {
  restaurant: Restaurant;
  ownerUserId: string | null;
  tables: Table[];
  mapSpots: MapSpot[];
  categories: MenuCategory[];
  menuItems: MenuItem[];
  sessions: Map<string, SessionRecord>;
  events: StoreEvent[];
  staff: { member: StaffMember; pinKey: string }[];
  guard: StaffGuard;
};

/** Todos os restaurantes de um processo (`pnpm dev`, `pnpm start` do E2E, CI). */
export type MemoryWorld = { restaurants: Map<string, RestaurantState>; pinKey: StaffPinKey };

const stateFrom = (data: RestaurantData, pinKey: StaffPinKey): RestaurantState => ({
  restaurant: structuredClone(data.restaurant),
  ownerUserId: data.ownerUserId,
  tables: structuredClone(data.tables),
  mapSpots: structuredClone(data.mapSpots),
  categories: structuredClone(data.categories),
  menuItems: structuredClone(data.menuItems),
  sessions: new Map(),
  events: [],
  staff: data.staff.map(({ pin, ...member }) => ({
    member: structuredClone(member),
    pinKey: pinKey(member.restaurantId, pin),
  })),
  guard: { failedAttempts: 0 },
});

/**
 * Mundo novo e vazio: os restaurantes nascem pelo cadastro da conta. Com `sample`, já vem o
 * restaurante de exemplo com ids fixos (base dos testes).
 */
export const createMemoryWorld = ({
  pinKey = defaultStaffPinKey(),
  sample = false,
}: { pinKey?: StaffPinKey; sample?: boolean } = {}): MemoryWorld => {
  const restaurants = new Map<string, RestaurantState>();
  if (sample) {
    const data = sampleRestaurantData();
    restaurants.set(data.restaurant.id, stateFrom(data, pinKey));
  }
  return { restaurants, pinKey };
};

/**
 * Repositório em memória de UM restaurante. Os dados somem quando o processo reinicia.
 * Tudo sai como cópia, para ninguém mexer por fora.
 */
export const createMemoryRepository = (world: MemoryWorld, restaurantId: string): Repository => {
  const state = () => {
    const found = world.restaurants.get(restaurantId);
    if (!found) throw new Error(`restaurante ${restaurantId} não existe`);
    return found;
  };

  const push = (event: Omit<StoreEvent, "seq">) => {
    const { events } = state();
    events.push({ ...event, seq: events.length + 1 });
  };

  return {
    async getRestaurant() {
      return structuredClone(state().restaurant);
    },
    async saveRestaurant(next, event) {
      state().restaurant = structuredClone(next);
      push(event);
    },
    async listTables() {
      return structuredClone(state().tables);
    },
    async listMapSpots() {
      return structuredClone(state().mapSpots);
    },
    async getMenu() {
      const { categories, menuItems } = state();
      return structuredClone({ categories, items: menuItems });
    },
    async saveMenuItem(item, event) {
      const current = state();
      current.menuItems = upsert(current.menuItems, [structuredClone(item)]);
      push(event);
    },
    async saveMenu(menu, event) {
      const current = state();
      current.categories = structuredClone(menu.categories);
      current.menuItems = structuredClone(menu.items);
      push(event);
    },

    async findSessionId(ref) {
      for (const record of state().sessions.values()) {
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
      const record = state().sessions.get(sessionId);
      return record ? structuredClone(record) : null;
    },

    async listSessions({ since }) {
      const sinceMs = since ? Date.parse(since) : Number.POSITIVE_INFINITY;
      return structuredClone(
        [...state().sessions.values()].filter(
          (record) => record.session.status === "open" || Date.parse(record.session.openedAt) >= sinceMs,
        ),
      );
    },

    async insertSession(record, event) {
      const { sessions } = state();
      const busy = [...sessions.values()].some(
        (entry) => entry.session.tableId === record.session.tableId && entry.session.status === "open",
      );
      if (busy) return false;
      sessions.set(record.session.id, { ...structuredClone(record), version: 1 });
      push(event);
      return true;
    },

    async saveSession(sessionId, expectedVersion, changes, event) {
      const { sessions } = state();
      const record = sessions.get(sessionId);
      // Tudo aqui é síncrono: ler a versão, aplicar e gravar acontece sem nada no meio.
      if (!record || record.version !== expectedVersion) return false;
      sessions.set(sessionId, apply(record, structuredClone(changes)));
      if (event) push(event);
      return true;
    },

    async getEvents(afterSeq, sessionId) {
      const { events } = state();
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
      return structuredClone(state().staff.map((entry) => entry.member));
    },

    async findStaffByPinKey(key) {
      const found = state().staff.find((entry) => entry.pinKey === key);
      return found ? structuredClone(found.member) : null;
    },

    async findStaffById(staffId) {
      const found = state().staff.find((entry) => entry.member.id === staffId);
      return found ? structuredClone(found.member) : null;
    },

    async insertStaff(member, key, event) {
      const current = state();
      if (current.staff.some((entry) => entry.pinKey === key)) return false;
      current.staff = [...current.staff, { member: structuredClone(member), pinKey: key }];
      push(event);
      return true;
    },

    async updateStaff(member, key, event) {
      const current = state();
      if (key !== null && current.staff.some((entry) => entry.pinKey === key && entry.member.id !== member.id)) return false;
      current.staff = current.staff.map((entry) =>
        entry.member.id === member.id ? { member: structuredClone(member), pinKey: key ?? entry.pinKey } : entry,
      );
      push(event);
      return true;
    },

    async getStaffGuard() {
      return structuredClone(state().guard);
    },

    async saveStaffGuard(next) {
      state().guard = structuredClone(next);
    },
  };
};

/** Cadastro dos restaurantes do mundo em memória. */
export const createMemoryRegistry = (world: MemoryWorld): RestaurantRegistry => {
  const record = (state: RestaurantState) => ({
    id: state.restaurant.id,
    slug: state.restaurant.slug,
    name: state.restaurant.name,
    ownerUserId: state.ownerUserId,
  });
  return {
    async findBySlug(slug) {
      const found = [...world.restaurants.values()].find((state) => state.restaurant.slug === slug);
      return found ? record(found) : null;
    },
    async listByOwner(ownerUserId) {
      return [...world.restaurants.values()].filter((state) => state.ownerUserId === ownerUserId).map(record);
    },
    async create(data) {
      const taken = [...world.restaurants.values()].some(
        (state) => state.restaurant.slug === data.restaurant.slug || state.restaurant.id === data.restaurant.id,
      );
      if (taken) return false;
      world.restaurants.set(data.restaurant.id, stateFrom(data, world.pinKey));
      return true;
    },
  };
};

/** Store do restaurante de exemplo num mundo novo (testes). */
export const createMemoryStore = (options: EngineOptions = {}): Store =>
  createStore(createMemoryRepository(createMemoryWorld({ pinKey: options.pinKey, sample: true }), RESTAURANT.id), options);
