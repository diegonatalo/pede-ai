import { describe, expect, it } from "vitest";
import { readSessionSecret } from "@/lib/api/config";

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
