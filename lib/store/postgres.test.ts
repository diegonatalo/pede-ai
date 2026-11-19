// @vitest-environment node
import { existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { beforeEach, describe, expect, it } from "vitest";
import { createStore } from "@/lib/store/engine";
import { createPostgresRepository } from "@/lib/store/postgres";
import { describeStoreContract } from "@/lib/store/store-contract";

// Banco de TESTE, nunca o de produção: cada teste apaga todas as tabelas.
// No Neon, use um banco separado (ex.: CREATE DATABASE pede_ai_test, com as migrações aplicadas)
// ou um branch, e ponha a URL dele em TEST_DATABASE_URL no .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url || url === process.env.DATABASE_URL)("store no Postgres", () => {
  beforeEach(async () => {
    const sql = neon(url as string);
    await sql`TRUNCATE events, waiter_calls, order_items, orders, tabs, table_sessions,
      menu_items, menu_categories, map_spots, dining_tables, restaurants RESTART IDENTITY CASCADE`;
  });

  // Um repositório novo por teste: os dados de demonstração voltam a ser gravados após o TRUNCATE.
  describeStoreContract((options) => createStore(createPostgresRepository(url as string), options));

  describe("gravações ao mesmo tempo", () => {
    const setup = async () => {
      const repo = createPostgresRepository(url as string);
      const store = createStore(repo);
      const opened = await store.openSession("mesa-2", "1234", "waiter");
      if (!opened.ok) throw new Error(opened.error);
      return { repo, store, sessionId: opened.value.id };
    };

    it("recusa gravar com a versão velha e desfaz o batch inteiro", async () => {
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
      const store = createStore(createPostgresRepository(url as string));
      const results = await Promise.all([
        store.openSession("mesa-5", "1111", "waiter"),
        store.openSession("mesa-5", "2222", "waiter"),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok && result.error === "already_open")).toHaveLength(1);
    });
  });
}, 60_000);
