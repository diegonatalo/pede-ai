import { describe, expect, it } from "vitest";
import { applyMenuChange, MENU_LIMITS, parseMenuChange, type MenuChange } from "@/lib/menu-editor";
import type { Menu } from "@/types/store";

const menu = (): Menu => ({
  categories: [
    { id: "c1", restaurantId: "r", name: "Entradas", position: 1 },
    { id: "c2", restaurantId: "r", name: "Bebidas", position: 2 },
  ],
  items: [
    { id: "i1", restaurantId: "r", categoryId: "c1", name: "Pão", description: "", priceCents: 1000, station: "kitchen", available: true },
    { id: "i2", restaurantId: "r", categoryId: "c2", name: "Água", description: "", priceCents: 500, station: "bar", available: true },
    { id: "i3", restaurantId: "r", categoryId: "c1", name: "Bolinho", description: "", priceCents: 2000, station: "kitchen", available: false },
  ],
});

const apply = (change: MenuChange, current = menu()) => {
  let counter = 0;
  return applyMenuChange(current, change, { restaurantId: "r", newId: () => `novo-${++counter}` });
};

const value = (result: ReturnType<typeof apply>) => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

const errorOf = (result: ReturnType<typeof apply>) => (result.ok ? "ok" : result.error);

const ids = (list: { id: string }[]) => list.map((entry) => entry.id);

describe("parseMenuChange", () => {
  it("aceita as mudanças com a forma certa", () => {
    expect(parseMenuChange({ type: "save_category", name: "Pratos" })).toEqual({ type: "save_category", name: "Pratos" });
    expect(parseMenuChange({ type: "move_item", id: "i1", direction: "down" })).toEqual({
      type: "move_item",
      id: "i1",
      direction: "down",
    });
    expect(
      parseMenuChange({ type: "save_item", categoryId: "c1", name: "Pão", priceCents: 1000, station: "kitchen" }),
    ).toMatchObject({ description: "" });
  });

  it("recusa o que não tem a forma certa", () => {
    expect(parseMenuChange(null)).toBeNull();
    expect(parseMenuChange({ type: "apagar_tudo" })).toBeNull();
    expect(parseMenuChange({ type: "delete_item" })).toBeNull();
    expect(parseMenuChange({ type: "save_category", id: 3, name: "x" })).toBeNull();
    expect(parseMenuChange({ type: "move_category", id: "c1", direction: "left" })).toBeNull();
    expect(
      parseMenuChange({ type: "save_item", categoryId: "c1", name: "Pão", priceCents: "10", station: "kitchen" }),
    ).toBeNull();
    expect(parseMenuChange({ type: "save_item", categoryId: "c1", name: "Pão", priceCents: 10, station: "forno" })).toBeNull();
  });
});

describe("categorias", () => {
  it("cria no fim, renomeia e numera as posições pela ordem", () => {
    const created = value(apply({ type: "save_category", name: "  Sobremesas " }));
    expect(created.entityId).toBe("novo-1");
    expect(created.menu.categories).toEqual([
      { id: "c1", restaurantId: "r", name: "Entradas", position: 0 },
      { id: "c2", restaurantId: "r", name: "Bebidas", position: 1 },
      { id: "novo-1", restaurantId: "r", name: "Sobremesas", position: 2 },
    ]);
    const renamed = value(apply({ type: "save_category", id: "c2", name: "Bebidas e sucos" }));
    expect(renamed.menu.categories[1].name).toBe("Bebidas e sucos");
  });

  it("recusa nome vazio ou longo e categoria que não existe", () => {
    expect(errorOf(apply({ type: "save_category", name: "   " }))).toBe("invalid_input");
    expect(errorOf(apply({ type: "save_category", name: "x".repeat(MENU_LIMITS.categoryName + 1) }))).toBe(
      "invalid_input",
    );
    expect(errorOf(apply({ type: "save_category", id: "c9", name: "Nada" }))).toBe("not_found");
  });

  it("move para cima e para baixo, parando nas pontas", () => {
    expect(ids(value(apply({ type: "move_category", id: "c2", direction: "up" })).menu.categories)).toEqual(["c2", "c1"]);
    expect(ids(value(apply({ type: "move_category", id: "c1", direction: "up" })).menu.categories)).toEqual(["c1", "c2"]);
    expect(ids(value(apply({ type: "move_category", id: "c2", direction: "down" })).menu.categories)).toEqual([
      "c1",
      "c2",
    ]);
  });

  it("só exclui categoria vazia", () => {
    expect(errorOf(apply({ type: "delete_category", id: "c1" }))).toBe("category_not_empty");
    const current = menu();
    current.items = current.items.filter((item) => item.categoryId !== "c2");
    const result = value(apply({ type: "delete_category", id: "c2" }, current));
    expect(ids(result.menu.categories)).toEqual(["c1"]);
  });

  it("respeita o limite de categorias", () => {
    const current = menu();
    current.categories = Array.from({ length: MENU_LIMITS.categories }, (_, index) => ({
      id: `c${index}`,
      restaurantId: "r",
      name: `C${index}`,
      position: index,
    }));
    expect(errorOf(apply({ type: "save_category", name: "Mais uma" }, current))).toBe("menu_full");
  });
});

describe("itens", () => {
  const newItem = { type: "save_item", categoryId: "c2", name: "Suco", description: " De laranja ", priceCents: 900, station: "bar" } as const;

  it("cria disponível, no fim, com o texto aparado", () => {
    const result = value(apply(newItem));
    expect(result.menu.items.at(-1)).toEqual({
      id: "novo-1",
      restaurantId: "r",
      categoryId: "c2",
      name: "Suco",
      description: "De laranja",
      priceCents: 900,
      station: "bar",
      available: true,
    });
  });

  it("edita mantendo a disponibilidade e o lugar; trocar de categoria leva para o fim", () => {
    const edited = value(apply({ ...newItem, id: "i3", categoryId: "c1", name: "Bolinho de bacalhau" }));
    expect(ids(edited.menu.items)).toEqual(["i1", "i2", "i3"]);
    expect(edited.menu.items[2]).toMatchObject({ name: "Bolinho de bacalhau", available: false, priceCents: 900 });

    const moved = value(apply({ ...newItem, id: "i1" }));
    expect(ids(moved.menu.items)).toEqual(["i2", "i3", "i1"]);
    expect(moved.menu.items[2].categoryId).toBe("c2");
  });

  it("recusa preço, nome, descrição e categoria inválidos", () => {
    expect(errorOf(apply({ ...newItem, priceCents: -1 }))).toBe("invalid_input");
    expect(errorOf(apply({ ...newItem, priceCents: 10.5 }))).toBe("invalid_input");
    expect(errorOf(apply({ ...newItem, priceCents: MENU_LIMITS.maxPriceCents + 1 }))).toBe("invalid_input");
    expect(errorOf(apply({ ...newItem, name: " " }))).toBe("invalid_input");
    expect(errorOf(apply({ ...newItem, description: "x".repeat(MENU_LIMITS.description + 1) }))).toBe("invalid_input");
    expect(errorOf(apply({ ...newItem, categoryId: "c9" }))).toBe("not_found");
    expect(errorOf(apply({ ...newItem, id: "i9" }))).toBe("not_found");
  });

  it("move dentro da própria categoria, pulando os itens das outras", () => {
    expect(ids(value(apply({ type: "move_item", id: "i3", direction: "up" })).menu.items)).toEqual(["i3", "i2", "i1"]);
    expect(ids(value(apply({ type: "move_item", id: "i2", direction: "up" })).menu.items)).toEqual(["i1", "i2", "i3"]);
  });

  it("exclui", () => {
    expect(ids(value(apply({ type: "delete_item", id: "i2" })).menu.items)).toEqual(["i1", "i3"]);
    expect(errorOf(apply({ type: "delete_item", id: "i9" }))).toBe("not_found");
  });
});
