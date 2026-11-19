import { describe, expect, it } from "vitest";
import { describePosition, landmarks, SPOT_KIND_LABEL } from "@/lib/map";
import { MAP_SPOTS } from "@/lib/seed-data";

const spot = (id: string) => {
  const found = MAP_SPOTS.find((entry) => entry.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("describePosition", () => {
  it("descreve os pontos do salão de demonstração", () => {
    expect(describePosition(spot("spot-restroom"))).toBe("ao fundo, à direita");
    expect(describePosition(spot("spot-kitchen"))).toBe("ao fundo, à esquerda");
    expect(describePosition(spot("spot-bar"))).toBe("ao fundo");
    expect(describePosition(spot("spot-cashier"))).toBe("perto da entrada, à esquerda");
    expect(describePosition(spot("spot-entrance"))).toBe("perto da entrada");
    expect(describePosition(spot("spot-mesa-3"))).toBe("no meio do salão");
    expect(describePosition(spot("spot-mesa-1"))).toBe("no meio do salão, à esquerda");
  });
});

describe("landmarks", () => {
  it("lista banheiros, caixa, cozinha, bar e entrada, sem as mesas", () => {
    expect(landmarks(MAP_SPOTS).map((entry) => entry.kind)).toEqual([
      "restroom",
      "cashier",
      "kitchen",
      "bar",
      "entrance",
    ]);
  });

  it("tem um nome para cada tipo de lugar", () => {
    expect(Object.keys(SPOT_KIND_LABEL)).toHaveLength(6);
  });
});
