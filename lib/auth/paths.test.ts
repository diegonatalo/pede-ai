import { describe, expect, it } from "vitest";
import { ACCOUNT_PATH, SIGN_IN_PATH, safeReturnPath, signInPath } from "@/lib/auth/paths";

describe("signInPath", () => {
  it("sem origem ou vindo da conta, vai direto para entrar", () => {
    expect(signInPath()).toBe(SIGN_IN_PATH);
    expect(signInPath(ACCOUNT_PATH)).toBe(SIGN_IN_PATH);
  });

  it("guarda a página de origem no ?de=", () => {
    expect(signInPath("/conta?aba=1")).toBe("/entrar?de=%2Fconta%3Faba%3D1");
  });
});

describe("safeReturnPath", () => {
  it("aceita caminhos da conta", () => {
    expect(safeReturnPath("/conta")).toBe("/conta");
    expect(safeReturnPath("/conta/x")).toBe("/conta/x");
    expect(safeReturnPath("/conta?aba=1")).toBe("/conta?aba=1");
  });

  it("recusa outros sites e caminhos fora da conta", () => {
    for (const target of [null, undefined, "", "https://mal.example", "//mal.example", "/\mal.example", "/contas", "/"]) {
      expect(safeReturnPath(target)).toBe(ACCOUNT_PATH);
    }
  });
});
