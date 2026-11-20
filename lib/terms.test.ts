import { describe, expect, it } from "vitest";
import { needsTermsAcceptance, termsAcceptance, TERMS_VERSION } from "@/lib/terms";

describe("needsTermsAcceptance", () => {
  it("pede o aceite de quem nunca aceitou ou aceitou uma versão antiga", () => {
    expect(needsTermsAcceptance(null)).toBe(true);
    expect(needsTermsAcceptance(undefined)).toBe(true);
    expect(needsTermsAcceptance("2020-01-01")).toBe(true);
  });

  it("não pede de novo a quem aceitou a versão atual", () => {
    expect(needsTermsAcceptance(TERMS_VERSION)).toBe(false);
  });
});

describe("termsAcceptance", () => {
  const now = new Date("2026-11-20T12:00:00Z");

  it("grava a versão atual com a data do servidor", () => {
    expect(termsAcceptance(TERMS_VERSION, now)).toEqual({ termsVersion: TERMS_VERSION, termsAcceptedAt: now });
  });

  it("recusa versão diferente da atual ou ausente", () => {
    expect(termsAcceptance("2020-01-01", now)).toBeNull();
    expect(termsAcceptance(undefined, now)).toBeNull();
  });
});
