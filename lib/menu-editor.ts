import type { MenuCategory, MenuItem, Station } from "@/types/domain";
import type { Menu, Result, StoreError } from "@/types/store";

/** Uma mudança no cardápio pelo gerente. Sem `id`, `save_*` cria. */
export type MenuChange =
  | { type: "save_category"; id?: string; name: string }
  | { type: "delete_category"; id: string }
  | { type: "move_category"; id: string; direction: MoveDirection }
  | {
      type: "save_item";
      id?: string;
      categoryId: string;
      name: string;
      description: string;
      priceCents: number;
      station: Station;
    }
  | { type: "delete_item"; id: string }
  | { type: "move_item"; id: string; direction: MoveDirection };

export type MoveDirection = "up" | "down";

export const MENU_LIMITS = {
  categoryName: 40,
  itemName: 60,
  description: 200,
  /** R$ 10.000,00: acima disso é quase certo um erro de digitação. */
  maxPriceCents: 1_000_000,
  categories: 30,
  items: 300,
} as const;

const STATIONS: readonly Station[] = ["kitchen", "bar"];
const DIRECTIONS: readonly MoveDirection[] = ["up", "down"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalId = (value: unknown) => (value === undefined ? undefined : typeof value === "string" ? value : null);

/** Lê o corpo da requisição como uma mudança no cardápio; `null` se a forma não bate. */
export const parseMenuChange = (body: unknown): MenuChange | null => {
  if (!isRecord(body)) return null;
  const id = optionalId(body.id);
  if (id === null) return null;
  switch (body.type) {
    case "save_category":
      return typeof body.name === "string" ? { type: "save_category", id, name: body.name } : null;
    case "delete_category":
    case "delete_item":
      return id ? { type: body.type, id } : null;
    case "move_category":
    case "move_item":
      return id && DIRECTIONS.includes(body.direction as MoveDirection)
        ? { type: body.type, id, direction: body.direction as MoveDirection }
        : null;
    case "save_item": {
      const { categoryId, name, description = "", priceCents, station } = body;
      if (typeof categoryId !== "string" || typeof name !== "string" || typeof description !== "string") return null;
      if (typeof priceCents !== "number" || !STATIONS.includes(station as Station)) return null;
      return { type: "save_item", id, categoryId, name, description, priceCents, station: station as Station };
    }
    default:
      return null;
  }
};

const fail = <T>(error: StoreError): Result<T> => ({ ok: false, error });

/** Troca de lugar com o vizinho (dentro do grupo de `sameGroup`); no limite, nada muda. */
const move = <T extends { id: string }>(list: T[], id: string, direction: MoveDirection, sameGroup: (a: T, b: T) => boolean) => {
  const index = list.findIndex((entry) => entry.id === id);
  const step = direction === "up" ? -1 : 1;
  let other = index + step;
  while (other >= 0 && other < list.length && !sameGroup(list[index], list[other])) other += step;
  if (other < 0 || other >= list.length) return list;
  const next = [...list];
  [next[index], next[other]] = [next[other], next[index]];
  return next;
};

type Context = { restaurantId: string; newId: () => string };

/**
 * Aplica a mudança e devolve o cardápio novo, com a ordem das listas como ordem de exibição.
 * Os pedidos guardam nome e preço do momento, então editar ou excluir um item não muda contas.
 */
export const applyMenuChange = (
  menu: Menu,
  change: MenuChange,
  { restaurantId, newId }: Context,
): Result<{ menu: Menu; entityId: string }> => {
  const { categories, items } = menu;
  // `position` sempre igual ao lugar na lista: as telas ordenam as categorias por ele.
  const positioned = (list: MenuCategory[]) => list.map((category, position) => ({ ...category, position }));
  const ok = (next: Partial<Menu>, entityId: string): Result<{ menu: Menu; entityId: string }> => ({
    ok: true,
    value: { menu: { categories: positioned(next.categories ?? categories), items: next.items ?? items }, entityId },
  });
  const findCategory = (id: string) => categories.find((category) => category.id === id);
  const findItem = (id: string) => items.find((item) => item.id === id);

  switch (change.type) {
    case "save_category": {
      const name = change.name.trim();
      if (!name || name.length > MENU_LIMITS.categoryName) return fail("invalid_input");
      if (change.id) {
        if (!findCategory(change.id)) return fail("not_found");
        return ok({ categories: categories.map((entry) => (entry.id === change.id ? { ...entry, name } : entry)) }, change.id);
      }
      if (categories.length >= MENU_LIMITS.categories) return fail("menu_full");
      const created: MenuCategory = { id: newId(), restaurantId, name, position: categories.length };
      return ok({ categories: [...categories, created] }, created.id);
    }
    case "delete_category": {
      if (!findCategory(change.id)) return fail("not_found");
      if (items.some((item) => item.categoryId === change.id)) return fail("category_not_empty");
      return ok({ categories: categories.filter((entry) => entry.id !== change.id) }, change.id);
    }
    case "move_category": {
      if (!findCategory(change.id)) return fail("not_found");
      return ok({ categories: move(categories, change.id, change.direction, () => true) }, change.id);
    }
    case "save_item": {
      const name = change.name.trim();
      const description = change.description.trim();
      if (!name || name.length > MENU_LIMITS.itemName || description.length > MENU_LIMITS.description) {
        return fail("invalid_input");
      }
      if (!Number.isInteger(change.priceCents) || change.priceCents < 0 || change.priceCents > MENU_LIMITS.maxPriceCents) {
        return fail("invalid_input");
      }
      if (!findCategory(change.categoryId)) return fail("not_found");
      const fields = { categoryId: change.categoryId, name, description, priceCents: change.priceCents, station: change.station };
      if (change.id) {
        const current = findItem(change.id);
        if (!current) return fail("not_found");
        // Mudou de categoria: vai para o fim da nova.
        const moved = current.categoryId !== change.categoryId;
        const updated: MenuItem = { ...current, ...fields };
        const rest = items.filter((item) => item.id !== change.id);
        return ok(
          { items: moved ? [...rest, updated] : items.map((item) => (item.id === change.id ? updated : item)) },
          change.id,
        );
      }
      if (items.length >= MENU_LIMITS.items) return fail("menu_full");
      const created: MenuItem = { id: newId(), restaurantId, available: true, ...fields };
      return ok({ items: [...items, created] }, created.id);
    }
    case "delete_item": {
      if (!findItem(change.id)) return fail("not_found");
      return ok({ items: items.filter((item) => item.id !== change.id) }, change.id);
    }
    case "move_item": {
      if (!findItem(change.id)) return fail("not_found");
      return ok({ items: move(items, change.id, change.direction, (a, b) => a.categoryId === b.categoryId) }, change.id);
    }
  }
};
