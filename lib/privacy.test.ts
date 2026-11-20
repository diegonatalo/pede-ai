import { describe, expect, it } from "vitest";
import { RETENTION_DAYS, retentionCutoff } from "@/lib/privacy";

describe("retentionCutoff", () => {
  it("volta o prazo de guarda a partir de agora", () => {
    expect(RETENTION_DAYS).toBe(30);
    expect(retentionCutoff(new Date("2026-11-30T12:00:00.000Z"))).toBe("2026-10-31T12:00:00.000Z");
    expect(retentionCutoff(new Date("2026-11-30T12:00:00.000Z"), 1)).toBe("2026-11-29T12:00:00.000Z");
  });
});
