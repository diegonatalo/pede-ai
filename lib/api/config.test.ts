import { describe, expect, it } from "vitest";
import { DEMO_PINS, readSessionSecret, readStaffPins } from "@/lib/api/config";

describe("readStaffPins", () => {
  it("usa os PINs da demo quando as variáveis não existem", () => {
    expect(readStaffPins({})).toEqual(DEMO_PINS);
  });

  it("usa as variáveis quando existem", () => {
    expect(readStaffPins({ STAFF_PIN_KITCHEN: "9", STAFF_PIN_WAITER: "8", STAFF_PIN_MANAGER: "7" })).toEqual({
      kitchen: "9",
      waiter: "8",
      manager: "7",
    });
  });
});

describe("readSessionSecret", () => {
  it("usa a variável quando existe", () => {
    expect(readSessionSecret({ SESSION_SECRET: "abc" })).toBe("abc");
  });

  it("gera uma chave estável no processo quando não existe", () => {
    const first = readSessionSecret({});
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(readSessionSecret({})).toBe(first);
  });
});
