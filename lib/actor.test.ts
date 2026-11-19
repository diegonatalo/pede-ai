import { describe, expect, it } from "vitest";
import { roleOf, staffIdOf } from "@/lib/actor";

describe("actor", () => {
  it("lê o papel e a pessoa de quem fez a ação", () => {
    expect(roleOf("customer")).toBe("customer");
    expect(staffIdOf("customer")).toBeUndefined();
    expect(roleOf({ role: "waiter", staffId: "s1" })).toBe("waiter");
    expect(staffIdOf({ role: "waiter", staffId: "s1" })).toBe("s1");
  });
});
