import { describe, expect, it } from "vitest";
import { cleanOptionalText, cleanText, isIntInRange, isJoinCode } from "@/lib/store/input";

describe("isIntInRange", () => {
  it("aceita inteiros dentro do intervalo", () => {
    expect(isIntInRange(1, 1, 20)).toBe(true);
    expect(isIntInRange(20, 1, 20)).toBe(true);
  });

  it.each([0, 21, 1.5, Number.NaN, "3", null])("recusa %j", (value) => {
    expect(isIntInRange(value, 1, 20)).toBe(false);
  });
});

describe("cleanText", () => {
  it("tira espaços das pontas e junta espaços repetidos", () => {
    expect(cleanText("  Ana   Paula ", 40)).toBe("Ana Paula");
  });

  it("recusa vazio, só espaços, longo demais e não texto", () => {
    expect(cleanText("", 40)).toBeNull();
    expect(cleanText("   ", 40)).toBeNull();
    expect(cleanText("a".repeat(41), 40)).toBeNull();
    expect(cleanText(42, 40)).toBeNull();
  });
});

describe("cleanOptionalText", () => {
  it("trata ausente e vazio como sem texto", () => {
    expect(cleanOptionalText(undefined, 10)).toBeUndefined();
    expect(cleanOptionalText("  ", 10)).toBeUndefined();
  });

  it("mantém o texto e recusa o que passa do limite", () => {
    expect(cleanOptionalText(" sem cebola ", 140)).toBe("sem cebola");
    expect(cleanOptionalText("a".repeat(11), 10)).toBeNull();
    expect(cleanOptionalText(5, 10)).toBeNull();
  });
});

describe("isJoinCode", () => {
  it("aceita só quatro dígitos", () => {
    expect(isJoinCode("0427")).toBe(true);
    expect(isJoinCode("427")).toBe(false);
    expect(isJoinCode("04270")).toBe(false);
    expect(isJoinCode("04a7")).toBe(false);
    expect(isJoinCode(427)).toBe(false);
  });
});
