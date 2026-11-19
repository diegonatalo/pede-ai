import { DEMO_STAFF, MAP_SPOTS, MENU_CATEGORIES, MENU_ITEMS, RESTAURANT, TABLES } from "@/lib/seed-data";
import type { MapSpot, MenuCategory, MenuItem, Restaurant, StaffMember, Table } from "@/types/domain";

/** Tudo que um restaurante tem ao nascer: configuração, salão, cardápio e equipe. */
export type RestaurantData = {
  restaurant: Restaurant;
  ownerUserId: string | null;
  tables: Table[];
  mapSpots: MapSpot[];
  categories: MenuCategory[];
  menuItems: MenuItem[];
  /** Pessoas da equipe com o PIN em claro (só para gerar a chave na hora de gravar). */
  staff: (StaffMember & { pin: string })[];
};

/** Endereços que não podem virar restaurante (rotas do app e nomes que confundem). */
const RESERVED_SLUGS = new Set(["demo", "api", "admin", "r", "conta", "entrar", "gerente", "garcom", "cozinha", "mesa", "suporte"]);

export const isReservedSlug = (slug: string) => RESERVED_SLUGS.has(slug);

/** `cantina-do-ze`: letras minúsculas, números e hífens, de 3 a 40 caracteres. */
export const isValidSlug = (slug: string) =>
  slug.length >= 3 && slug.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && !RESERVED_SLUGS.has(slug);

/** Restaurantes por conta enquanto tudo é gratuito: evita encher o banco com restaurantes de teste. */
export const MAX_RESTAURANTS_PER_OWNER = 3;

/** Id do dono na equipe do restaurante: é por ele que a conta entra como gerente. */
export const ownerStaffIdFor = (restaurantId: string) => `${restaurantId}-owner`;

/** Sugere o endereço a partir do nome: "Cantina do Zé!" → "cantina-do-ze". */
export const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");

/** O restaurante de demonstração, com os PINs públicos. */
export const demoRestaurantData = (): RestaurantData => ({
  restaurant: structuredClone(RESTAURANT),
  ownerUserId: null,
  tables: structuredClone(TABLES),
  mapSpots: structuredClone(MAP_SPOTS),
  categories: structuredClone(MENU_CATEGORIES),
  menuItems: structuredClone(MENU_ITEMS),
  staff: structuredClone(DEMO_STAFF),
});

type NewRestaurant = {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
  owner: { staffId: string; name: string; pin: string };
  createdAt: string;
  newId: () => string;
};

/**
 * Restaurante novo com o salão e o cardápio de exemplo, todos com ids novos (no banco são
 * chaves primárias, e dois restaurantes não podem ter a mesma "mesa-1"). O dono entra na
 * equipe como gerente. O cardápio de exemplo é para editar depois.
 */
export const newRestaurantData = ({ id, slug, name, ownerUserId, owner, createdAt, newId }: NewRestaurant): RestaurantData => {
  const tableIds = new Map(TABLES.map((table) => [table.id, newId()]));
  const categoryIds = new Map(MENU_CATEGORIES.map((category) => [category.id, newId()]));
  return {
    restaurant: { ...structuredClone(RESTAURANT), id, slug, name },
    ownerUserId,
    tables: TABLES.map((table) => ({ ...table, id: tableIds.get(table.id) as string, restaurantId: id })),
    mapSpots: MAP_SPOTS.map((spot) => ({
      ...spot,
      id: newId(),
      restaurantId: id,
      ...(spot.tableId && { tableId: tableIds.get(spot.tableId) }),
    })),
    categories: MENU_CATEGORIES.map((category) => ({
      ...category,
      id: categoryIds.get(category.id) as string,
      restaurantId: id,
    })),
    menuItems: MENU_ITEMS.map((item) => ({
      ...item,
      id: newId(),
      restaurantId: id,
      categoryId: categoryIds.get(item.categoryId) as string,
    })),
    staff: [
      {
        id: owner.staffId,
        restaurantId: id,
        name: owner.name,
        role: "manager",
        active: true,
        system: false,
        createdAt,
        pin: owner.pin,
      },
    ],
  };
};
