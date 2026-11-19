import type { MapSpot, MapSpotKind } from "@/types/domain";

/** Nome de cada tipo de lugar no mapa, para a legenda e a descrição em texto. */
export const SPOT_KIND_LABEL: Record<MapSpotKind, string> = {
  table: "Mesa",
  restroom: "Banheiros",
  cashier: "Caixa",
  kitchen: "Cozinha",
  bar: "Bar",
  entrance: "Entrada",
};

/**
 * Onde fica um ponto, em palavras, pela grade de 100 × 100 (fundo em cima, entrada embaixo):
 * "ao fundo, à direita", "no meio do salão", "perto da entrada, à esquerda".
 */
export const describePosition = (spot: Pick<MapSpot, "x" | "y" | "w" | "h">) => {
  const centerX = spot.x + spot.w / 2;
  const centerY = spot.y + spot.h / 2;
  const depth = centerY < 34 ? "ao fundo" : centerY > 66 ? "perto da entrada" : "no meio do salão";
  const side = centerX < 34 ? "à esquerda" : centerX > 66 ? "à direita" : "";
  return side ? `${depth}, ${side}` : depth;
};

/** Pontos que o cliente procura (banheiro, caixa...), na ordem da legenda, sem as mesas. */
export const landmarks = (spots: MapSpot[]) => {
  const order: MapSpotKind[] = ["restroom", "cashier", "kitchen", "bar", "entrance"];
  return spots
    .filter((spot) => spot.kind !== "table")
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
};
