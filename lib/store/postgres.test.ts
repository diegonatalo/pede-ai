// @vitest-environment node
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { assertDevDatabase } from "@/lib/dev-database";
import { newRestaurantData, sampleRestaurantData } from "@/lib/restaurant-template";
import { RESTAURANT } from "@/lib/seed-data";
import { createStore } from "@/lib/store/engine";
import { describeIsolationContract } from "@/lib/store/isolation-contract";
import {
  createPostgresAttemptCounter,
  createPostgresPushStore,
  createPostgresRateLimiter,
  createPostgresRegistry,
  createPostgresRepository,
} from "@/lib/store/postgres";
import { describePushStoreContract } from "@/lib/store/push-contract";
import { describeRateLimiterContract } from "@/lib/store/rate-limit-contract";
import { describeStoreContract } from "@/lib/store/store-contract";

// Fora do Next, o `server-only` sempre lança: aqui ele não faz nada, como no servidor.
vi.mock("server-only", () => ({}));

// Banco de TESTE, nunca o de produção: cada teste apaga todas as tabelas.
// No Neon, use um banco separado (ex.: CREATE DATABASE pede_ai_dev_test, com as migrações aplicadas)
// ou um branch, e ponha a URL dele em TEST_DATABASE_URL no .env.local.
// No CI, TEST_DATABASE_URL é o Postgres descartável do ci.yml (o mesmo do build e do E2E, que vêm depois).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.TEST_DATABASE_URL;
if (url) assertDevDatabase(process.env, ["TEST_DATABASE_URL"]);
const sameAsApp = url === process.env.DATABASE_URL && !process.env.CI;

// Uma conexão (pool) por banco aberto nos testes; todas fecham no fim.
const pools: Pool[] = [];
const openDb = (): Db => {
  const pool = new Pool({ connectionString: url, max: 5 });
  pools.push(pool);
  return drizzle(pool, { schema });
};

describe.skipIf(!url || sameAsApp)("store no Postgres", () => {
  let db: Db;
  const SAMPLE = () => ({ restaurantId: RESTAURANT.id, db });

  beforeAll(async () => {
    db = openDb();
    // o mesmo `drizzle/` do deploy: o teste roda contra o schema de verdade
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await Promise.all(pools.map((pool) => pool.end()));
  });

  beforeEach(async () => {
    await db.execute(
      `TRUNCATE push_subscriptions, rate_limits, events, waiter_calls, order_items, orders, tabs, table_sessions, staff_members,
      menu_items, menu_categories, map_spots, dining_tables, restaurants RESTART IDENTITY CASCADE`,
    );
    // O app não cria restaurante sozinho: cada teste começa com o restaurante de exemplo.
    expect(await createPostgresRegistry({ db }).create(sampleRestaurantData())).toBe(true);
  });

  describeStoreContract((options) => createStore(createPostgresRepository(SAMPLE()), options));

  describe("contador de tentativas do login", () => {
    const attempt = { key: "auth:teste", nowMs: 1_000_000, windowMs: 10_000, max: 3 };

    it("tentativas ao mesmo tempo, em conexões separadas, recebem números diferentes", async () => {
      const counters = [createPostgresAttemptCounter(openDb()), createPostgresAttemptCounter(openDb())];
      const results = await Promise.all(Array.from({ length: 12 }, (_, i) => counters[i % 2](attempt)));
      expect(results.filter((result) => result.count <= attempt.max).map((result) => result.count).sort()).toEqual([1, 2, 3]);
      expect(Math.max(...results.map((result) => result.count))).toBe(attempt.max + 1);
    });

    it("insistir não estica a janela, e ela recomeça quando vence", async () => {
      const count = createPostgresAttemptCounter(db);
      await count(attempt);
      expect(await count({ ...attempt, nowMs: attempt.nowMs + 9999 })).toEqual({ count: 2, windowStart: attempt.nowMs });
      const later = attempt.nowMs + attempt.windowMs;
      expect(await count({ ...attempt, nowMs: later })).toEqual({ count: 1, windowStart: later });
    });
  });

  describeRateLimiterContract((config) => createPostgresRateLimiter({ db, ...config }));

  describe("com um segundo restaurante", () => {
    beforeEach(async () => {
      let counter = 0;
      const second = newRestaurantData({
        id: "rest-b",
        slug: "cantina-b",
        name: "Cantina B",
        ownerUserId: "user-b",
        owner: { staffId: "dono-b", name: "Dono B", pin: "707070" },
        createdAt: "2026-11-20T00:00:00.000Z",
        newId: () => `push-b-${++counter}`,
      });
      expect(await createPostgresRegistry({ db }).create(second)).toBe(true);
    });
    describePushStoreContract(() => createPostgresPushStore({ db }));
  });

  // Dois restaurantes no mesmo banco, numa conexão só (como no app).
  describeIsolationContract(() => {
    return {
      registry: createPostgresRegistry({ db }),
      storeFor: (restaurantId) => createStore(createPostgresRepository({ restaurantId, db })),
    };
  });

  describe("gravações ao mesmo tempo", () => {
    const setup = async () => {
      const repo = createPostgresRepository(SAMPLE());
      const store = createStore(repo);
      const opened = await store.openSession("mesa-2", "1234", "waiter");
      if (!opened.ok) throw new Error(opened.error);
      return { repo, store, sessionId: opened.value.id };
    };

    it("recusa gravar com a versão velha e desfaz a transação inteira", async () => {
      const { repo, store, sessionId } = await setup();
      const record = await repo.loadSession(sessionId);
      if (!record) throw new Error("mesa não carregou");
      expect(await repo.saveSession(sessionId, record.version, {}, null)).toBe(true);

      const tab = {
        id: "comanda-atrasada",
        sessionId,
        customerName: "Atrasada",
        peopleCount: 1,
        status: "open" as const,
        approved: true,
        createdAt: new Date().toISOString(),
      };
      const event = { type: "tab_created" as const, at: tab.createdAt, actor: "customer" as const, entityId: tab.id, sessionId };
      const { lastSeq } = await store.getEvents(0);
      expect(await repo.saveSession(sessionId, record.version, { tabs: [tab] }, event)).toBe(false);

      expect((await repo.loadSession(sessionId))?.tabs).toEqual([]);
      expect((await store.getEvents(0)).lastSeq).toBe(lastSeq);
    });

    it("não perde nenhuma comanda quando várias pessoas abrem ao mesmo tempo", async () => {
      const { store, sessionId } = await setup();
      const results = await Promise.all(
        ["Ana", "Bia", "Caio", "Dani"].map((customerName) =>
          store.createTab({ sessionId, customerName, peopleCount: 1 }, "customer"),
        ),
      );
      for (const result of results) expect(result.ok || result.error === "conflict").toBe(true);
      const snapshot = await store.getSessionSnapshot(sessionId);
      const names = snapshot.ok ? snapshot.value.tabs.map((tab) => tab.customerName).sort() : [];
      const accepted = results.flatMap((result) => (result.ok ? [result.value.customerName] : [])).sort();
      // Cada "ok" foi gravado, e nada além deles.
      expect(names).toEqual(accepted);
      expect(accepted.length).toBeGreaterThan(0);
    });

    it("deixa só um garçom abrir a mesma mesa", async () => {
      const store = createStore(createPostgresRepository(SAMPLE()));
      const results = await Promise.all([
        store.openSession("mesa-5", "1111", "waiter"),
        store.openSession("mesa-5", "2222", "waiter"),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok && result.error === "already_open")).toHaveLength(1);
    });
  });
}, 60_000);
