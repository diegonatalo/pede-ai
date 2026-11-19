import { describe, expect, it } from "vitest";
import { generateJoinCode } from "@/lib/join-code";

describe("generateJoinCode", () => {
  it("gera sempre quatro dígitos", () => {
    for (let index = 0; index < 200; index += 1) expect(generateJoinCode()).toMatch(/^\d{4}$/);
  });

  it("completa com zeros à esquerda", () => {
    expect(generateJoinCode((array) => array.fill(7))).toBe("0007");
    expect(generateJoinCode((array) => array.fill(123_456))).toBe("3456");
  });
});
