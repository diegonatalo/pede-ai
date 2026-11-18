import { describe, expect, it } from "vitest";
import { MAP_SPOTS, MENU_CATEGORIES, MENU_ITEMS, RESTAURANT, TABLES } from "@/lib/seed-data";

const ids = (list: { id: string }[]) => list.map((entry) => entry.id);
const hasUniqueIds = (list: { id: string }[]) => new Set(ids(list)).size === list.length;

describe("seed-data", () => {
  it("não repete ids", () => {
    for (const list of [TABLES, MAP_SPOTS, MENU_CATEGORIES, MENU_ITEMS]) {
      expect(hasUniqueIds(list)).toBe(true);
    }
  });

  it("liga tudo ao restaurante de demonstração", () => {
    for (const entry of [...TABLES, ...MAP_SPOTS, ...MENU_CATEGORIES, ...MENU_ITEMS]) {
      expect(entry.restaurantId).toBe(RESTAURANT.id);
    }
  });

  it("usa preços em centavos inteiros e positivos", () => {
    for (const menuItem of MENU_ITEMS) {
      expect(Number.isInteger(menuItem.priceCents)).toBe(true);
      expect(menuItem.priceCents).toBeGreaterThan(0);
    }
  });

  it("coloca cada item numa categoria existente, e toda categoria tem itens", () => {
    const categoryIds = new Set(ids(MENU_CATEGORIES));
    for (const menuItem of MENU_ITEMS) expect(categoryIds.has(menuItem.categoryId)).toBe(true);
    for (const category of MENU_CATEGORIES) {
      expect(MENU_ITEMS.some((menuItem) => menuItem.categoryId === category.id)).toBe(true);
    }
  });

  it("tem itens da cozinha e do bar", () => {
    expect(MENU_ITEMS.some((menuItem) => menuItem.station === "kitchen")).toBe(true);
    expect(MENU_ITEMS.some((menuItem) => menuItem.station === "bar")).toBe(true);
  });

  it("põe cada mesa uma vez no mapa, dentro da grade de 100 × 100", () => {
    const tableSpots = MAP_SPOTS.filter((spot) => spot.kind === "table");
    expect(tableSpots.map((spot) => spot.tableId).sort()).toEqual(ids(TABLES).sort());
    for (const spot of MAP_SPOTS) {
      expect(spot.x).toBeGreaterThanOrEqual(0);
      expect(spot.y).toBeGreaterThanOrEqual(0);
      expect(spot.x + spot.w).toBeLessThanOrEqual(100);
      expect(spot.y + spot.h).toBeLessThanOrEqual(100);
    }
  });

  it("mostra no mapa os banheiros, o caixa e a cozinha", () => {
    const kinds = new Set(MAP_SPOTS.map((spot) => spot.kind));
    for (const kind of ["restroom", "cashier", "kitchen"] as const) expect(kinds.has(kind)).toBe(true);
  });

  it("não sobrepõe pontos do mapa", () => {
    const overlaps = (a: (typeof MAP_SPOTS)[number], b: (typeof MAP_SPOTS)[number]) =>
      a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const [index, a] of MAP_SPOTS.entries()) {
      for (const b of MAP_SPOTS.slice(index + 1)) expect(overlaps(a, b), `${a.id} × ${b.id}`).toBe(false);
    }
  });
});
