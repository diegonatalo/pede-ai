// @vitest-environment node
import { existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { beforeEach, describe } from "vitest";
import { createStore } from "@/lib/store/engine";
import { createPostgresRepository } from "@/lib/store/postgres";
import { describeStoreContract } from "@/lib/store/store-contract";

// Banco de TESTE, nunca o de produção: cada teste apaga todas as tabelas.
// No Neon, crie um branch só para isso e ponha a URL dele em TEST_DATABASE_URL no .env.local.
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
}, 60_000);
