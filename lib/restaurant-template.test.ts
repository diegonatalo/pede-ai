import { describe, expect, it } from "vitest";
import { demoRestaurantData, isValidSlug, newRestaurantData, slugify } from "@/lib/restaurant-template";

describe("slug", () => {
  it("sugere o endereço a partir do nome", () => {
    expect(slugify("Cantina do Zé!")).toBe("cantina-do-ze");
    expect(slugify("  Bar & Restaurante São João  ")).toBe("bar-restaurante-sao-joao");
    expect(slugify("A".repeat(60))).toHaveLength(40);
  });

  it("aceita só letras minúsculas, números e hífens, fora dos nomes reservados", () => {
    expect(isValidSlug("cantina-do-ze")).toBe(true);
    expect(isValidSlug("bar2")).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("Cantina")).toBe(false);
    expect(isValidSlug("cantina--ze")).toBe(false);
    expect(isValidSlug("-cantina")).toBe(false);
    expect(isValidSlug("demo")).toBe(false);
    expect(isValidSlug("api")).toBe(false);
  });
});

describe("newRestaurantData", () => {
  let counter = 0;
  const data = newRestaurantData({
    id: "r2",
    slug: "cantina-do-ze",
    name: "Cantina do Zé",
    ownerUserId: "user-1",
    owner: { staffId: "dono", name: "Zé", pin: "482913" },
    createdAt: "2026-11-19T00:00:00.000Z",
    newId: () => `novo-${++counter}`,
  });
  const demo = demoRestaurantData();

  it("copia o salão e o cardápio de exemplo com ids novos, todos do restaurante novo", () => {
    expect(data.restaurant).toMatchObject({ id: "r2", slug: "cantina-do-ze", name: "Cantina do Zé" });
    expect(data.tables).toHaveLength(demo.tables.length);
    expect(data.menuItems).toHaveLength(demo.menuItems.length);
    const demoIds = new Set([...demo.tables, ...demo.menuItems, ...demo.categories, ...demo.mapSpots].map((entry) => entry.id));
    for (const entry of [...data.tables, ...data.menuItems, ...data.categories, ...data.mapSpots]) {
      expect(demoIds.has(entry.id)).toBe(false);
      expect(entry.restaurantId).toBe("r2");
    }
  });

  it("mantém as ligações: itens nas categorias novas e o mapa nas mesas novas", () => {
    const categoryIds = new Set(data.categories.map((category) => category.id));
    for (const item of data.menuItems) expect(categoryIds.has(item.categoryId)).toBe(true);
    const tableIds = new Set(data.tables.map((table) => table.id));
    const tableSpots = data.mapSpots.filter((spot) => spot.kind === "table");
    expect(tableSpots.map((spot) => spot.tableId).sort()).toEqual([...tableIds].sort());
  });

  it("põe o dono na equipe como gerente", () => {
    expect(data.ownerUserId).toBe("user-1");
    expect(data.staff).toEqual([
      expect.objectContaining({ id: "dono", name: "Zé", role: "manager", system: false, active: true, pin: "482913" }),
    ]);
  });
});
