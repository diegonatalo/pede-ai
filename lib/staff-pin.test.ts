// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateStaffPin, isStaffPin, staffPinKeyFor } from "@/lib/staff-pin";

describe("isStaffPin", () => {
  it("aceita de 4 a 8 dígitos", () => {
    expect(isStaffPin("1111")).toBe(true);
    expect(isStaffPin("482913")).toBe(true);
    expect(isStaffPin("123")).toBe(false);
    expect(isStaffPin("123456789")).toBe(false);
    expect(isStaffPin("12a4")).toBe(false);
    expect(isStaffPin(1234)).toBe(false);
  });
});

describe("generateStaffPin", () => {
  it("gera sempre 6 dígitos, com zeros à esquerda", () => {
    for (let index = 0; index < 100; index += 1) expect(generateStaffPin()).toMatch(/^\d{6}$/);
    expect(generateStaffPin((array) => array.fill(42))).toBe("000042");
  });
});

describe("staffPinKeyFor", () => {
  const key = staffPinKeyFor("segredo");

  it("é estável e não contém o PIN", () => {
    expect(key("demo", "482913")).toBe(key("demo", "482913"));
    expect(key("demo", "482913")).not.toContain("482913");
  });

  it("muda com o restaurante, o PIN e a chave do app", () => {
    expect(key("demo", "482913")).not.toBe(key("outro", "482913"));
    expect(key("demo", "482913")).not.toBe(key("demo", "482914"));
    expect(staffPinKeyFor("outra-chave")("demo", "482913")).not.toBe(key("demo", "482913"));
  });
});
