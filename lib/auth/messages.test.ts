import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth/messages";

describe("authErrorMessage", () => {
  it("traduz os erros conhecidos", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe("E-mail ou senha errados.");
    expect(authErrorMessage({ code: "USER_ALREADY_EXISTS", status: 422 })).toMatch(/Já existe uma conta/);
    expect(authErrorMessage({ code: "PASSWORD_TOO_SHORT", status: 400 })).toMatch(/8 caracteres/);
    expect(authErrorMessage({ code: "PASSWORD_REQUIRED", status: 400 })).toMatch(/Digite a sua senha/);
    expect(authErrorMessage({ code: "INVALID_NAME", status: 400 })).toMatch(/60 caracteres/);
  });

  it("avisa sobre excesso de tentativas pelo status", () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/Muitas tentativas/);
  });

  it("usa uma mensagem genérica para o resto", () => {
    expect(authErrorMessage({ code: "ALGO_NOVO", status: 500 })).toBe("Algo deu errado. Tente de novo.");
    expect(authErrorMessage(null)).toBe("Algo deu errado. Tente de novo.");
  });
});
