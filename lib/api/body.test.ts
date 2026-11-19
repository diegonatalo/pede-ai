import { describe, expect, it } from "vitest";
import { isRecord, optionalString, parseAfter } from "@/lib/api/body";

describe("isRecord", () => {
  it("aceita só objetos simples", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });
});

describe("optionalString", () => {
  it("separa ausente, texto e tipo errado", () => {
    expect(optionalString(undefined)).toBeUndefined();
    expect(optionalString("sem gelo")).toBe("sem gelo");
    expect(optionalString(3)).toBeNull();
  });
});

describe("parseAfter", () => {
  it.each([
    ["12", 12],
    [null, 0],
    ["", 0],
    ["-3", 0],
    ["1.5", 0],
    ["abc", 0],
  ])("lê %j como %i", (value, expected) => {
    expect(parseAfter(value)).toBe(expected);
  });
});
