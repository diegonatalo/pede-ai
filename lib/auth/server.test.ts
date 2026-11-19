// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createAuth } from "@/lib/auth/server";

// Sem DATABASE_URL o login usa a memória. Cada teste usa um e-mail próprio, porque a memória
// fica no globalThis do processo (como no `pnpm dev`).
const auth = createAuth({ SESSION_SECRET: "segredo-de-teste-com-tamanho-suficiente" });
let counter = 0;
const email = () => `dono${++counter}-${Date.now()}@exemplo.com`;

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return (error as { body?: { code?: string } }).body?.code ?? "sem código";
  }
};

describe("login das contas", () => {
  it("cria a conta e já devolve a sessão", async () => {
    const address = email();
    const result = await auth.api.signUpEmail({ body: { name: "Diego", email: address, password: "senha-forte-1" } });
    expect(result.user).toMatchObject({ name: "Diego", email: address, emailVerified: false });
    expect(result.token).toBeTruthy();
  });

  it("entra com a senha certa", async () => {
    const address = email();
    await auth.api.signUpEmail({ body: { name: "Ana", email: address, password: "senha-forte-1" } });
    const result = await auth.api.signInEmail({ body: { email: address, password: "senha-forte-1" } });
    expect(result.user.email).toBe(address);
  });

  it("recusa senha errada, senha curta e e-mail repetido", async () => {
    const address = email();
    await auth.api.signUpEmail({ body: { name: "Bia", email: address, password: "senha-forte-1" } });
    expect(await codeOf(auth.api.signInEmail({ body: { email: address, password: "errada-123" } }))).toBe(
      "INVALID_EMAIL_OR_PASSWORD",
    );
    expect(await codeOf(auth.api.signUpEmail({ body: { name: "Caio", email: email(), password: "curta" } }))).toBe(
      "PASSWORD_TOO_SHORT",
    );
    expect(
      await codeOf(auth.api.signUpEmail({ body: { name: "Outra", email: address, password: "senha-forte-2" } })),
    ).toMatch(/USER_ALREADY_EXISTS/);
  });
});
