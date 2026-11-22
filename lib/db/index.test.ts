// @vitest-environment node
import { inspect } from "node:util";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: () => ({
    batch: async () => {
      throw Object.assign(new Error("duplicate key"), { code: "23505", detail: "Key (name)=(Maria da mesa 4) already exists." });
    },
  }),
}));

import { createDb } from "@/lib/db";

describe("createDb", () => {
  it("o erro de um batch não leva os valores, só o código", async () => {
    const db = createDb("postgres://localhost/app");
    const error = await db.batch([] as never).then(
      () => null,
      (failure: unknown) => failure,
    );
    expect(error).toMatchObject({ code: "23505" });
    expect(inspect(error, { depth: 10, showHidden: true })).not.toContain("Maria");
  });
});
