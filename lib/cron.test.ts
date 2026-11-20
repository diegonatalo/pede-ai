// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/cron";

describe("isCronAuthorized", () => {
  it("aceita só o segredo certo no formato Bearer", () => {
    expect(isCronAuthorized("Bearer segredo-longo", "segredo-longo")).toBe(true);
    expect(isCronAuthorized("Bearer outro", "segredo-longo")).toBe(false);
    expect(isCronAuthorized("segredo-longo", "segredo-longo")).toBe(false);
    expect(isCronAuthorized(null, "segredo-longo")).toBe(false);
  });

  it("recusa tudo quando o segredo não está configurado", () => {
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
  });
});
