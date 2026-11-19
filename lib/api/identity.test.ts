import { describe, expect, it } from "vitest";
import { isStaffRole, parseCustomerIdentity, parseStaffIdentity, rolesOf, seatKey } from "@/lib/api/identity";

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
  it("aceita quem entrou em cada tela de cada restaurante", () => {
    const value = {
      seats: { "demo:waiter": { id: "a", name: "Ana" }, "cantina-b:kitchen": { id: "b", name: "Bia" } },
      exp: NOW + 1,
    };
    expect(parseStaffIdentity(value, NOW)).toEqual(value);
  });

  it("recusa chave sem restaurante, tela de cliente, pessoa malformada e cookie vencido", () => {
    expect(parseStaffIdentity({ seats: { waiter: { id: "a", name: "Ana" } }, exp: NOW + 1 }, NOW)).toBeNull();
    expect(parseStaffIdentity({ seats: { "demo:customer": { id: "a", name: "Ana" } }, exp: NOW + 1 }, NOW)).toBeNull();
    expect(parseStaffIdentity({ seats: { "demo:waiter": { id: 1, name: "Ana" } }, exp: NOW + 1 }, NOW)).toBeNull();
    expect(parseStaffIdentity({ seats: {}, exp: NOW + 1 }, NOW)).toBeNull();
    expect(parseStaffIdentity({ seats: { "demo:waiter": { id: "a", name: "Ana" } }, exp: NOW - 1 }, NOW)).toBeNull();
    expect(parseStaffIdentity({ roles: ["waiter"], exp: NOW + 1 }, NOW)).toBeNull();
  });
});

describe("rolesOf e seatKey", () => {
  it("lista as telas do restaurante em que alguém entrou, na ordem fixa", () => {
    const identity = {
      seats: {
        [seatKey("demo", "manager")]: { id: "m", name: "M" },
        [seatKey("demo", "kitchen")]: { id: "k", name: "K" },
        [seatKey("outro", "waiter")]: { id: "w", name: "W" },
      },
      exp: NOW + 1,
    };
    expect(rolesOf(identity, "demo")).toEqual(["kitchen", "manager"]);
    expect(rolesOf(identity, "outro")).toEqual(["waiter"]);
    expect(rolesOf(null, "demo")).toEqual([]);
  });
});

describe("isStaffRole", () => {
  it("reconhece só os papéis da equipe", () => {
    expect(isStaffRole("manager")).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
});
