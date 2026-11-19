import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";

// Regras que o repositório do Postgres pressupõe (lib/store/postgres.ts). Uma tabela nova que
// esqueça delas faria a mesa carregar incompleta ou fora de ordem, sem erro nenhum.

const columnNames = (table: Parameters<typeof getTableColumns>[0]) =>
  Object.values(getTableColumns(table)).map((column) => column.name);

describe("schema do banco", () => {
  it("põe session_id e a ordem de criação (n) em toda tabela que faz parte da mesa", () => {
    for (const table of [schema.tabs, schema.orders, schema.orderItems, schema.waiterCalls]) {
      expect(columnNames(table), getTableName(table)).toEqual(expect.arrayContaining(["session_id", "n"]));
    }
  });

  it("guarda a versão e o código da mesa na sessão", () => {
    expect(columnNames(schema.tableSessions)).toEqual(
      expect.arrayContaining(["version", "join_code", "failed_attempts", "locked_until", "n"]),
    );
  });

  it("dá uma posição a tudo que o cardápio e o salão listam em ordem", () => {
    for (const table of [schema.diningTables, schema.mapSpots, schema.menuCategories, schema.menuItems]) {
      expect(columnNames(table), getTableName(table)).toContain("position");
    }
  });

  it("liga o catálogo ao restaurante, pensando em vários restaurantes", () => {
    for (const table of [schema.diningTables, schema.mapSpots, schema.menuCategories, schema.menuItems, schema.tableSessions]) {
      expect(columnNames(table), getTableName(table)).toContain("restaurant_id");
    }
  });
});
