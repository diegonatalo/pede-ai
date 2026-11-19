import { describe, expect, it } from "vitest";
import { isStaffRole, parseCustomerIdentity, parseStaffIdentity } from "@/lib/api/identity";

const NOW = 1_000_000;

describe("parseCustomerIdentity", () => {
  it("aceita um cookie válido", () => {
    const value = { sessionId: "s1", tabIds: ["t1", "t2"], exp: NOW + 1 };
    expect(parseCustomerIdentity(value, NOW)).toEqual(value);
  });

  it.each([
    null,
    "texto",
    { sessionId: "s1", tabIds: [], exp: NOW },
    { sessionId: 1, tabIds: [], exp: NOW + 1 },
    { sessionId: "s1", tabIds: [1], exp: NOW + 1 },
    { sessionId: "s1", exp: NOW + 1 },
  ])("recusa %j", (value) => {
    expect(parseCustomerIdentity(value, NOW)).toBeNull();
  });
});

describe("parseStaffIdentity", () => {
  it("aceita papéis da equipe e tira repetidos", () => {
    expect(parseStaffIdentity({ roles: ["waiter", "kitchen", "waiter"], exp: NOW + 1 }, NOW)).toEqual({
      roles: ["waiter", "kitchen"],
      exp: NOW + 1,
    });
  });

  it("recusa cliente como papel, lista vazia e cookie vencido", () => {
    expect(parseStaffIdentity({ roles: ["customer"], exp: NOW + 1 }, NOW)).toBeNull();
    expect(parseStaffIdentity({ roles: [], exp: NOW + 1 }, NOW)).toBeNull();
    expect(parseStaffIdentity({ roles: ["waiter"], exp: NOW - 1 }, NOW)).toBeNull();
  });
});

describe("isStaffRole", () => {
  it("reconhece só os papéis da equipe", () => {
    expect(isStaffRole("manager")).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
});
