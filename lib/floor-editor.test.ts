import { describe, expect, it } from "vitest";
import {
  activeTables,
  applyFloorChange,
  FLOOR_LIMITS,
  parseFloorChange,
  shortTableLabel,
  type Floor,
  type FloorChange,
} from "@/lib/floor-editor";

const floor = (): Floor => ({
  tables: [
    { id: "t1", restaurantId: "r", label: "Mesa 1", archived: false },
    { id: "t2", restaurantId: "r", label: "Mesa 2", archived: false },
    { id: "old", restaurantId: "r", label: "Mesa velha", archived: true },
    { id: "t3", restaurantId: "r", label: "Varanda", archived: false },
  ],
  mapSpots: [
    { id: "s1", restaurantId: "r", kind: "table", label: "1", tableId: "t1", x: 10, y: 10, w: 10, h: 10 },
    { id: "s2", restaurantId: "r", kind: "restroom", label: "Banheiros", x: 80, y: 0, w: 20, h: 10 },
  ],
});

const apply = (change: FloorChange, current = floor(), open: string[] = []) => {
  let counter = 0;
  return applyFloorChange(current, change, {
    restaurantId: "r",
    newId: () => `novo-${++counter}`,
    openTableIds: new Set(open),
  });
};

const value = (result: ReturnType<typeof apply>) => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
const errorOf = (result: ReturnType<typeof apply>) => (result.ok ? "ok" : result.error);
const labels = (current: Floor) => activeTables(current.tables).map((table) => table.label);

describe("parseFloorChange", () => {
  it("aceita as mudanças com a forma certa", () => {
    expect(parseFloorChange({ type: "save_table", label: "Mesa 9" })).toEqual({ type: "save_table", label: "Mesa 9" });
    expect(parseFloorChange({ type: "move_table", id: "t1", direction: "down" })).toEqual({
      type: "move_table",
      id: "t1",
      direction: "down",
    });
    expect(
      parseFloorChange({ type: "save_map", spots: [{ kind: "bar", x: 0, y: 0, w: 10, h: 10 }] }),
    ).toEqual({ type: "save_map", spots: [{ kind: "bar", x: 0, y: 0, w: 10, h: 10 }] });
  });

  it("recusa o que não tem a forma certa", () => {
    expect(parseFloorChange({ type: "archive_table" })).toBeNull();
    expect(parseFloorChange({ type: "save_table", id: 1, label: "x" })).toBeNull();
    expect(parseFloorChange({ type: "save_map", spots: [{ kind: "piscina", x: 0, y: 0, w: 10, h: 10 }] })).toBeNull();
    expect(parseFloorChange({ type: "save_map", spots: [{ kind: "bar", x: 0.5, y: 0, w: 10, h: 10 }] })).toBeNull();
    expect(parseFloorChange({ type: "save_map", spots: "tudo" })).toBeNull();
  });
});

describe("mesas", () => {
  it("cria no fim, com o nome arrumado, e recusa nome repetido (sem diferença de maiúsculas)", () => {
    const created = value(apply({ type: "save_table", label: "  Mesa   9 " }));
    expect(created.entityId).toBe("novo-1");
    expect(labels(created.floor)).toEqual(["Mesa 1", "Mesa 2", "Varanda", "Mesa 9"]);
    expect(errorOf(apply({ type: "save_table", label: "mesa 2" }))).toBe("duplicate_label");
    // Nome de mesa arquivada pode voltar a ser usado.
    expect(errorOf(apply({ type: "save_table", label: "Mesa velha" }))).toBe("ok");
    expect(errorOf(apply({ type: "save_table", label: " " }))).toBe("invalid_input");
    expect(errorOf(apply({ type: "save_table", label: "x".repeat(FLOOR_LIMITS.tableLabel + 1) }))).toBe("invalid_input");
  });

  it("renomeia, e o ponto da mesa no mapa acompanha", () => {
    const renamed = value(apply({ type: "save_table", id: "t1", label: "Mesa 10" }));
    expect(labels(renamed.floor)[0]).toBe("Mesa 10");
    expect(renamed.floor.mapSpots.find((spot) => spot.tableId === "t1")?.label).toBe("10");
    expect(errorOf(apply({ type: "save_table", id: "t1", label: "Mesa 1" }))).toBe("ok");
    expect(errorOf(apply({ type: "save_table", id: "old", label: "Volta" }))).toBe("not_found");
  });

  it("arquiva fora do mapa, mas não a mesa aberta agora", () => {
    expect(errorOf(apply({ type: "archive_table", id: "t1" }, floor(), ["t1"]))).toBe("table_in_use");
    const archived = value(apply({ type: "archive_table", id: "t1" }));
    expect(labels(archived.floor)).toEqual(["Mesa 2", "Varanda"]);
    // Continua guardada (o histórico de vendas aponta para ela) e sai do mapa.
    expect(archived.floor.tables.find((table) => table.id === "t1")?.archived).toBe(true);
    expect(archived.floor.mapSpots.map((spot) => spot.id)).toEqual(["s2"]);
  });

  it("muda a ordem pulando as arquivadas e para nas pontas", () => {
    expect(labels(value(apply({ type: "move_table", id: "t3", direction: "up" })).floor)).toEqual([
      "Mesa 1",
      "Varanda",
      "Mesa 2",
    ]);
    expect(labels(value(apply({ type: "move_table", id: "t1", direction: "up" })).floor)).toEqual([
      "Mesa 1",
      "Mesa 2",
      "Varanda",
    ]);
  });
});

describe("mapa", () => {
  it("troca o mapa inteiro, mantém ids conhecidos e cria ids novos", () => {
    const saved = value(
      apply({
        type: "save_map",
        spots: [
          { id: "s1", kind: "table", tableId: "t1", x: 0, y: 0, w: 10, h: 10 },
          { kind: "table", tableId: "t3", x: 20, y: 20, w: 12, h: 12 },
          { id: "de-outro-restaurante", kind: "cashier", x: 0, y: 90, w: 20, h: 10 },
        ],
      }),
    );
    expect(saved.floor.mapSpots).toEqual([
      { id: "s1", restaurantId: "r", kind: "table", label: "1", tableId: "t1", x: 0, y: 0, w: 10, h: 10 },
      { id: "novo-1", restaurantId: "r", kind: "table", label: "Varanda", tableId: "t3", x: 20, y: 20, w: 12, h: 12 },
      { id: "novo-2", restaurantId: "r", kind: "cashier", label: "Caixa", x: 0, y: 90, w: 20, h: 10 },
    ]);
  });

  it("recusa ponto fora da grade, pequeno demais, mesa repetida, arquivada ou de outro tipo", () => {
    const spot = (extra: object) => apply({ type: "save_map", spots: [{ kind: "bar", x: 0, y: 0, w: 10, h: 10, ...extra }] });
    expect(errorOf(spot({ x: 95 }))).toBe("invalid_input");
    expect(errorOf(spot({ w: 2 }))).toBe("invalid_input");
    expect(errorOf(spot({ tableId: "t1" }))).toBe("invalid_input");
    expect(errorOf(spot({ kind: "table", tableId: "old" }))).toBe("invalid_input");
    expect(errorOf(spot({ kind: "table" }))).toBe("invalid_input");
    expect(
      errorOf(
        apply({
          type: "save_map",
          spots: [
            { kind: "table", tableId: "t1", x: 0, y: 0, w: 10, h: 10 },
            { kind: "table", tableId: "t1", x: 50, y: 50, w: 10, h: 10 },
          ],
        }),
      ),
    ).toBe("invalid_input");
  });

  it("mapa vazio é permitido (o mapa é opcional)", () => {
    expect(value(apply({ type: "save_map", spots: [] })).floor.mapSpots).toEqual([]);
  });
});

describe("shortTableLabel", () => {
  it("tira o 'Mesa' do começo e deixa outros nomes", () => {
    expect(shortTableLabel("Mesa 12")).toBe("12");
    expect(shortTableLabel("mesa  3")).toBe("3");
    expect(shortTableLabel("Varanda")).toBe("Varanda");
  });
});
