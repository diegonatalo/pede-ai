import { SPOT_KIND_LABEL } from "@/lib/map";
import type { MapSpot, MapSpotKind, Table } from "@/types/domain";
import type { Result, StoreError } from "@/types/store";

/** Salão do restaurante: as mesas (inclusive as arquivadas) e o mapa. */
export type Floor = { tables: Table[]; mapSpots: MapSpot[] };

/** Ponto do mapa como o gerente desenha (o id e o restaurante vêm do servidor). */
export type SpotInput = {
  id?: string;
  kind: MapSpotKind;
  /** Nome no mapa; nas mesas, vem da própria mesa. */
  label?: string;
  tableId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Uma mudança no salão pelo gerente. Sem `id`, `save_table` cria. */
export type FloorChange =
  | { type: "save_table"; id?: string; label: string }
  | { type: "archive_table"; id: string }
  | { type: "move_table"; id: string; direction: "up" | "down" }
  /** Troca o mapa inteiro (o gerente edita no aparelho e salva de uma vez). */
  | { type: "save_map"; spots: SpotInput[] };

export const FLOOR_LIMITS = {
  tableLabel: 30,
  spotLabel: 20,
  tables: 100,
  spots: 150,
  /** Menor lado de um ponto, na grade de 100 × 100. */
  minSize: 4,
} as const;

export const SPOT_KINDS: readonly MapSpotKind[] = ["table", "restroom", "cashier", "kitchen", "bar", "entrance"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

const parseSpot = (value: unknown): SpotInput | null => {
  if (!isRecord(value) || !SPOT_KINDS.includes(value.kind as MapSpotKind)) return null;
  const { id, label, tableId, x, y, w, h } = value;
  if (![x, y, w, h].every(isInt)) return null;
  if (id !== undefined && typeof id !== "string") return null;
  if (label !== undefined && typeof label !== "string") return null;
  if (tableId !== undefined && typeof tableId !== "string") return null;
  return {
    kind: value.kind as MapSpotKind,
    ...(id !== undefined && { id }),
    ...(label !== undefined && { label }),
    ...(tableId !== undefined && { tableId }),
    x: x as number,
    y: y as number,
    w: w as number,
    h: h as number,
  };
};

/** Lê o corpo da requisição como uma mudança no salão; `null` se a forma não bate. */
export const parseFloorChange = (body: unknown): FloorChange | null => {
  if (!isRecord(body)) return null;
  const id = body.id;
  if (id !== undefined && typeof id !== "string") return null;
  switch (body.type) {
    case "save_table":
      return typeof body.label === "string" ? { type: "save_table", ...(id && { id }), label: body.label } : null;
    case "archive_table":
      return id ? { type: "archive_table", id } : null;
    case "move_table":
      return id && (body.direction === "up" || body.direction === "down")
        ? { type: "move_table", id, direction: body.direction }
        : null;
    case "save_map": {
      if (!Array.isArray(body.spots)) return null;
      const spots = body.spots.map(parseSpot);
      return spots.every((spot): spot is SpotInput => spot !== null) ? { type: "save_map", spots } : null;
    }
    default:
      return null;
  }
};

/** Nome curto da mesa dentro do mapa: "Mesa 12" → "12"; outros nomes ficam como estão. */
export const shortTableLabel = (label: string) => label.replace(/^mesa\s+/i, "").slice(0, FLOOR_LIMITS.spotLabel);

/** Mesas em uso (as arquivadas ficam guardadas para o histórico de vendas). */
export const activeTables = (tables: Table[]) => tables.filter((table) => !table.archived);

type Context = {
  restaurantId: string;
  newId: () => string;
  /** Mesas com a sessão aberta agora: não dá para arquivar. */
  openTableIds: Set<string>;
};

const fail = <T>(error: StoreError): Result<T> => ({ ok: false, error });

const sameLabel = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }) === 0;

/** Pontos de mesa acompanham o nome da mesa; mesas arquivadas saem do mapa. */
const syncSpots = (spots: MapSpot[], tables: Table[]) => {
  const byId = new Map(tables.map((table) => [table.id, table]));
  return spots
    .filter((spot) => spot.kind !== "table" || (spot.tableId && !byId.get(spot.tableId)?.archived && byId.has(spot.tableId)))
    .map((spot) =>
      spot.kind === "table" && spot.tableId
        ? { ...spot, label: shortTableLabel(byId.get(spot.tableId)?.label ?? spot.label) }
        : spot,
    );
};

/** Aplica a mudança e devolve o salão novo (a ordem da lista de mesas é a ordem de exibição). */
export const applyFloorChange = (
  floor: Floor,
  change: FloorChange,
  { restaurantId, newId, openTableIds }: Context,
): Result<{ floor: Floor; entityId: string }> => {
  const { tables, mapSpots } = floor;
  const active = activeTables(tables);
  const ok = (nextTables: Table[], nextSpots: MapSpot[], entityId: string): Result<{ floor: Floor; entityId: string }> => ({
    ok: true,
    value: { floor: { tables: nextTables, mapSpots: syncSpots(nextSpots, nextTables) }, entityId },
  });

  switch (change.type) {
    case "save_table": {
      const label = change.label.trim().replace(/\s+/g, " ");
      if (!label || label.length > FLOOR_LIMITS.tableLabel) return fail("invalid_input");
      if (active.some((table) => table.id !== change.id && sameLabel(table.label, label))) return fail("duplicate_label");
      if (change.id) {
        const current = active.find((table) => table.id === change.id);
        if (!current) return fail("not_found");
        return ok(
          tables.map((table) => (table.id === change.id ? { ...table, label } : table)),
          mapSpots,
          change.id,
        );
      }
      if (active.length >= FLOOR_LIMITS.tables) return fail("floor_full");
      const created: Table = { id: newId(), restaurantId, label, archived: false };
      return ok([...tables, created], mapSpots, created.id);
    }
    case "archive_table": {
      if (!active.some((table) => table.id === change.id)) return fail("not_found");
      if (openTableIds.has(change.id)) return fail("table_in_use");
      return ok(
        tables.map((table) => (table.id === change.id ? { ...table, archived: true } : table)),
        mapSpots,
        change.id,
      );
    }
    case "move_table": {
      const index = tables.findIndex((table) => table.id === change.id && !table.archived);
      if (index < 0) return fail("not_found");
      const step = change.direction === "up" ? -1 : 1;
      let other = index + step;
      while (other >= 0 && other < tables.length && tables[other].archived) other += step;
      if (other < 0 || other >= tables.length) return ok(tables, mapSpots, change.id);
      const next = [...tables];
      [next[index], next[other]] = [next[other], next[index]];
      return ok(next, mapSpots, change.id);
    }
    case "save_map": {
      if (change.spots.length > FLOOR_LIMITS.spots) return fail("floor_full");
      const activeIds = new Set(active.map((table) => table.id));
      const placed = new Set<string>();
      const existing = new Set(mapSpots.map((spot) => spot.id));
      const spots: MapSpot[] = [];
      for (const input of change.spots) {
        const { x, y, w, h } = input;
        const inside = x >= 0 && y >= 0 && w >= FLOOR_LIMITS.minSize && h >= FLOOR_LIMITS.minSize && x + w <= 100 && y + h <= 100;
        if (!inside) return fail("invalid_input");
        if (input.kind === "table") {
          // Cada mesa aparece uma vez só, e só mesas em uso.
          if (!input.tableId || !activeIds.has(input.tableId) || placed.has(input.tableId)) return fail("invalid_input");
          placed.add(input.tableId);
        } else if (input.tableId) {
          return fail("invalid_input");
        }
        const label = (input.label ?? "").trim() || (input.kind === "table" ? "" : SPOT_KIND_LABEL[input.kind]);
        if (label.length > FLOOR_LIMITS.spotLabel) return fail("invalid_input");
        spots.push({
          // Id novo para ponto novo; id que não é deste mapa também vira novo (não mexe em outro restaurante).
          id: input.id && existing.has(input.id) ? input.id : newId(),
          restaurantId,
          kind: input.kind,
          label,
          ...(input.tableId && { tableId: input.tableId }),
          x,
          y,
          w,
          h,
        });
      }
      return ok(tables, spots, "map");
    }
  }
};
