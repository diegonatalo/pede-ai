import { describe, expect, it } from "vitest";
import { getStore } from "@/lib/store";

describe("getStore", () => {
  it("devolve sempre o mesmo store no processo", () => {
    expect(getStore()).toBe(getStore());
  });
});
