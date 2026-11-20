import { RESTAURANT } from "@/lib/seed-data";
import { createStore } from "@/lib/store/engine";
import type { PushStore } from "@/lib/push";
import type { RateLimiter } from "@/lib/rate-limit";
import {
  createMemoryPushStore,
  createMemoryRateLimiter,
  createMemoryRegistry,
  createMemoryRepository,
  createMemoryWorld,
  type MemoryWorld,
} from "@/lib/store/memory";
import {
  createPostgresDb,
  createPostgresPushStore,
  createPostgresRateLimiter,
  createPostgresRegistry,
  createPostgresRepository,
  type Db,
} from "@/lib/store/postgres";
import type { RestaurantRegistry, Store } from "@/types/store";

// Guardado no globalThis para sobreviver ao recarregamento de módulos do `next dev`
// (e porque cada rota pode carregar a própria cópia deste módulo).
const holder = globalThis as typeof globalThis & {
  __pedeAiWorld?: MemoryWorld;
  __pedeAiStores?: Map<string, Store>;
  __pedeAiPostgresDb?: Db;
  __pedeAiPostgresStores?: Map<string, Store>;
  __pedeAiRateLimiter?: RateLimiter;
  __pedeAiPushStore?: PushStore;
};

const methodsOf = (store: Store) => Object.keys(store).sort().join(",");

type Env = Record<string, string | undefined>;

/**
 * Qual banco usar. Postgres só na Vercel (`VERCEL`) ou quando pedido (`PEDE_AI_STORE=postgres`):
 * o `.env.local` tem a `DATABASE_URL` de produção, e o `pnpm dev` e o E2E não devem gravar lá.
 */
export const storeKind = (env: Env): "postgres" | "memory" =>
  env.DATABASE_URL && (env.VERCEL || env.PEDE_AI_STORE === "postgres") ? "postgres" : "memory";

const postgresDb = () => {
  holder.__pedeAiPostgresDb ??= createPostgresDb(process.env.DATABASE_URL as string);
  return holder.__pedeAiPostgresDb;
};

/** Mundo em memória do processo, refeito no `next dev` se o motor ganhou métodos novos. */
const memoryWorld = () => {
  if (holder.__pedeAiWorld && process.env.NODE_ENV !== "production") {
    const held = holder.__pedeAiStores?.values().next().value;
    const probe = createStore(createMemoryRepository(createMemoryWorld({ sample: true }), RESTAURANT.id));
    if (held && methodsOf(probe) !== methodsOf(held)) {
      holder.__pedeAiWorld = undefined;
      holder.__pedeAiStores = undefined;
    }
  }
  holder.__pedeAiWorld ??= createMemoryWorld();
  return holder.__pedeAiWorld;
};

/**
 * Camada de dados de UM restaurante: Postgres (Neon) em produção, memória no resto.
 * Tudo o que o store lê e grava fica dentro desse restaurante.
 *
 * No `next dev`, mudanças só dentro de um método do motor pedem reiniciar o `pnpm dev`.
 */
export const getStore = (restaurantId: string): Store => {
  if (storeKind(process.env) === "postgres") {
    holder.__pedeAiPostgresStores ??= new Map();
    let store = holder.__pedeAiPostgresStores.get(restaurantId);
    if (!store) {
      store = createStore(
        createPostgresRepository(process.env.DATABASE_URL as string, { restaurantId, db: postgresDb() }),
      );
      holder.__pedeAiPostgresStores.set(restaurantId, store);
    }
    return store;
  }
  const world = memoryWorld();
  holder.__pedeAiStores ??= new Map();
  let store = holder.__pedeAiStores.get(restaurantId);
  if (!store) {
    store = createStore(createMemoryRepository(world, restaurantId), { pinKey: world.pinKey });
    holder.__pedeAiStores.set(restaurantId, store);
  }
  return store;
};

/** Limite de códigos de mesa errados por endereço de internet (todas as mesas e restaurantes). */
export const getRateLimiter = (): RateLimiter => {
  if (storeKind(process.env) === "postgres") {
    return createPostgresRateLimiter(process.env.DATABASE_URL as string, { db: postgresDb() });
  }
  holder.__pedeAiRateLimiter ??= createMemoryRateLimiter();
  return holder.__pedeAiRateLimiter;
};

/** Aparelhos da equipe inscritos para receber avisos. */
export const getPushStore = (): PushStore => {
  if (storeKind(process.env) === "postgres") {
    return createPostgresPushStore(process.env.DATABASE_URL as string, { db: postgresDb() });
  }
  holder.__pedeAiPushStore ??= createMemoryPushStore();
  return holder.__pedeAiPushStore;
};

/** Cadastro dos restaurantes (achar pelo endereço ou pelo dono, criar um novo). */
export const getRegistry = (): RestaurantRegistry =>
  storeKind(process.env) === "postgres"
    ? createPostgresRegistry(process.env.DATABASE_URL as string, { db: postgresDb() })
    : createMemoryRegistry(memoryWorld());
