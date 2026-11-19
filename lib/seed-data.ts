import type { MapSpot, MenuCategory, MenuItem, Restaurant, StaffMember, StaffRole, Table } from "@/types/domain";

/**
 * Restaurante de demonstração. É o estado inicial do adaptador em memória e o seed do banco.
 * Preços em centavos.
 */
export const RESTAURANT: Restaurant = {
  id: "demo",
  name: "Cantina Pede Aí",
  serviceFeePercent: 10,
  couvertCents: 0,
  requireFirstOrderApproval: true,
};

const r = RESTAURANT.id;

export const TABLES: Table[] = [
  { id: "mesa-1", restaurantId: r, label: "Mesa 1", seats: 2 },
  { id: "mesa-2", restaurantId: r, label: "Mesa 2", seats: 2 },
  { id: "mesa-3", restaurantId: r, label: "Mesa 3", seats: 4 },
  { id: "mesa-4", restaurantId: r, label: "Mesa 4", seats: 4 },
  { id: "mesa-5", restaurantId: r, label: "Mesa 5", seats: 4 },
  { id: "mesa-6", restaurantId: r, label: "Mesa 6", seats: 6 },
  { id: "mesa-7", restaurantId: r, label: "Mesa 7", seats: 6 },
  { id: "mesa-8", restaurantId: r, label: "Mesa 8", seats: 8 },
];

/** Planta numa grade de 100 × 100: cozinha e bar ao fundo, entrada embaixo. */
export const MAP_SPOTS: MapSpot[] = [
  { id: "spot-kitchen", restaurantId: r, kind: "kitchen", label: "Cozinha", x: 0, y: 0, w: 40, h: 18 },
  { id: "spot-bar", restaurantId: r, kind: "bar", label: "Bar", x: 42, y: 0, w: 28, h: 18 },
  { id: "spot-restroom", restaurantId: r, kind: "restroom", label: "Banheiros", x: 72, y: 0, w: 28, h: 18 },
  { id: "spot-mesa-1", restaurantId: r, kind: "table", label: "1", tableId: "mesa-1", x: 6, y: 28, w: 12, h: 12 },
  { id: "spot-mesa-2", restaurantId: r, kind: "table", label: "2", tableId: "mesa-2", x: 6, y: 50, w: 12, h: 12 },
  { id: "spot-mesa-3", restaurantId: r, kind: "table", label: "3", tableId: "mesa-3", x: 30, y: 28, w: 16, h: 14 },
  { id: "spot-mesa-4", restaurantId: r, kind: "table", label: "4", tableId: "mesa-4", x: 30, y: 50, w: 16, h: 14 },
  { id: "spot-mesa-5", restaurantId: r, kind: "table", label: "5", tableId: "mesa-5", x: 56, y: 28, w: 16, h: 14 },
  { id: "spot-mesa-6", restaurantId: r, kind: "table", label: "6", tableId: "mesa-6", x: 56, y: 50, w: 20, h: 14 },
  { id: "spot-mesa-7", restaurantId: r, kind: "table", label: "7", tableId: "mesa-7", x: 82, y: 28, w: 14, h: 20 },
  { id: "spot-mesa-8", restaurantId: r, kind: "table", label: "8", tableId: "mesa-8", x: 82, y: 54, w: 14, h: 24 },
  { id: "spot-cashier", restaurantId: r, kind: "cashier", label: "Caixa", x: 6, y: 82, w: 24, h: 14 },
  { id: "spot-entrance", restaurantId: r, kind: "entrance", label: "Entrada", x: 40, y: 90, w: 20, h: 10 },
];

export const MENU_CATEGORIES: MenuCategory[] = [
  { id: "entradas", restaurantId: r, name: "Entradas", position: 1 },
  { id: "pratos", restaurantId: r, name: "Pratos principais", position: 2 },
  { id: "sobremesas", restaurantId: r, name: "Sobremesas", position: 3 },
  { id: "bebidas", restaurantId: r, name: "Bebidas", position: 4 },
  { id: "drinks", restaurantId: r, name: "Drinks e vinhos", position: 5 },
];

const item = (
  id: string,
  categoryId: string,
  name: string,
  description: string,
  priceCents: number,
  station: MenuItem["station"],
): MenuItem => ({ id, restaurantId: r, categoryId, name, description, priceCents, station, available: true });

export const MENU_ITEMS: MenuItem[] = [
  item("bruschetta", "entradas", "Bruschetta", "Pão italiano, tomate, manjericão e azeite. 4 unidades.", 3200, "kitchen"),
  item("polenta", "entradas", "Polenta frita", "Porção para dividir, com parmesão ralado.", 2900, "kitchen"),
  item("burrata", "entradas", "Burrata", "Com tomate confit e pesto. Serve duas pessoas.", 5800, "kitchen"),
  item("carbonara", "pratos", "Espaguete à carbonara", "Guanciale, ovo, pecorino e pimenta-do-reino.", 5900, "kitchen"),
  item("lasanha", "pratos", "Lasanha à bolonhesa", "Massa fresca, ragu de carne e bechamel.", 6200, "kitchen"),
  item("risoto", "pratos", "Risoto de cogumelos", "Arbório, mix de cogumelos e parmesão. Vegetariano.", 6400, "kitchen"),
  item("parmegiana", "pratos", "Filé à parmegiana", "Com arroz e fritas. Serve bem duas pessoas.", 9800, "kitchen"),
  item("nhoque", "pratos", "Nhoque ao sugo", "Nhoque de batata com molho de tomate e manjericão.", 5200, "kitchen"),
  item("tiramisu", "sobremesas", "Tiramisù", "Café, mascarpone e cacau.", 2600, "kitchen"),
  item("panna-cotta", "sobremesas", "Panna cotta", "Com calda de frutas vermelhas.", 2400, "kitchen"),
  item("agua", "bebidas", "Água mineral", "500 ml, com ou sem gás.", 700, "bar"),
  item("refrigerante", "bebidas", "Refrigerante", "Lata 350 ml.", 800, "bar"),
  item("suco", "bebidas", "Suco natural", "Laranja, limão ou abacaxi com hortelã. 400 ml.", 1400, "bar"),
  item("cafe", "bebidas", "Café espresso", "Dose simples.", 700, "bar"),
  item("chope", "drinks", "Chope", "Pilsen, 300 ml.", 1300, "bar"),
  item("caipirinha", "drinks", "Caipirinha", "Limão, cachaça e açúcar.", 2400, "bar"),
  item("aperol", "drinks", "Aperol spritz", "Aperol, espumante e água com gás.", 3200, "bar"),
  item("vinho-taca", "drinks", "Vinho tinto (taça)", "Montepulciano d'Abruzzo, 150 ml.", 2800, "bar"),
  item("vinho-garrafa", "drinks", "Vinho tinto (garrafa)", "Montepulciano d'Abruzzo, 750 ml.", 12900, "bar"),
];

/** PINs públicos da demonstração, mostrados na página inicial. */
export const DEMO_PINS: Record<StaffRole, string> = { kitchen: "1111", waiter: "2222", manager: "3333" };

/** Equipe da demonstração: uma pessoa por papel, com o PIN público. Não pode ser desativada. */
export const DEMO_STAFF: (StaffMember & { pin: string })[] = (
  [
    ["staff-demo-kitchen", "Cozinha da demo", "kitchen"],
    ["staff-demo-waiter", "Garçom da demo", "waiter"],
    ["staff-demo-manager", "Gerente da demo", "manager"],
  ] as const
).map(([id, name, role]) => ({
  id,
  restaurantId: r,
  name,
  role,
  active: true,
  system: true,
  createdAt: "2026-11-19T00:00:00.000Z",
  pin: DEMO_PINS[role],
}));
