import { describe, expect, it } from "vitest";
import { isStaffRole, parseCustomerIdentity, parseStaffIdentity, rolesOf } from "@/lib/api/identity";

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
  it("aceita quem entrou em cada tela", () => {
    const value = { seats: { waiter: { id: "a", name: "Ana" }, kitchen: { id: "b", name: "Bia" } }, exp: NOW + 1 };
    expect(parseStaffIdentity(value, NOW)).toEqual(value);
  });

  it("recusa tela de cliente, pessoa malformada, nenhuma tela e cookie vencido", () => {
    expect(parseStaffIdentity({ seats: { customer: { id: "a", name: "Ana" } }, exp: NOW + 1 }, NOW)).toBeNull();
    expect(parseStaffIdentity({ seats: { waiter: { id: 1, name: "Ana" } }, exp: NOW + 1 }, NOW)).toBeNull();
    expect(parseStaffIdentity({ seats: {}, exp: NOW + 1 }, NOW)).toBeNull();
    expect(parseStaffIdentity({ seats: { waiter: { id: "a", name: "Ana" } }, exp: NOW - 1 }, NOW)).toBeNull();
    // Cookie do formato antigo (só papéis) deixa de valer: a pessoa entra de novo com o PIN.
    expect(parseStaffIdentity({ roles: ["waiter"], exp: NOW + 1 }, NOW)).toBeNull();
  });
});

describe("rolesOf", () => {
  it("lista as telas em que alguém entrou, na ordem fixa", () => {
    expect(rolesOf({ seats: { manager: { id: "m", name: "M" }, kitchen: { id: "k", name: "K" } }, exp: NOW + 1 })).toEqual([
      "kitchen",
      "manager",
    ]);
    expect(rolesOf(null)).toEqual([]);
  });
});

describe("isStaffRole", () => {
  it("reconhece só os papéis da equipe", () => {
    expect(isStaffRole("manager")).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
});
