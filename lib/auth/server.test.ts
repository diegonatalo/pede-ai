// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createAuth } from "@/lib/auth/server";
import { TERMS_VERSION } from "@/lib/terms";

// Fora do Next, o `server-only` sempre lança: aqui ele não faz nada, como no servidor.
vi.mock("server-only", () => ({}));

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
    const result = await auth.api.signUpEmail({ body: { name: "Diego", email: address, password: "senha-forte-1", termsVersion: TERMS_VERSION } });
    expect(result.user).toMatchObject({ name: "Diego", email: address, emailVerified: false });
    expect(result.token).toBeTruthy();
  });

  it("entra com a senha certa", async () => {
    const address = email();
    await auth.api.signUpEmail({ body: { name: "Ana", email: address, password: "senha-forte-1", termsVersion: TERMS_VERSION } });
    const result = await auth.api.signInEmail({ body: { email: address, password: "senha-forte-1" } });
    expect(result.user.email).toBe(address);
  });

  it("recusa senha errada, senha curta e e-mail repetido", async () => {
    const address = email();
    await auth.api.signUpEmail({ body: { name: "Bia", email: address, password: "senha-forte-1", termsVersion: TERMS_VERSION } });
    expect(await codeOf(auth.api.signInEmail({ body: { email: address, password: "errada-123" } }))).toBe(
      "INVALID_EMAIL_OR_PASSWORD",
    );
    expect(await codeOf(auth.api.signUpEmail({ body: { name: "Caio", email: email(), password: "curta", termsVersion: TERMS_VERSION } }))).toBe(
      "PASSWORD_TOO_SHORT",
    );
    expect(
      await codeOf(auth.api.signUpEmail({ body: { name: "Outra", email: address, password: "senha-forte-2", termsVersion: TERMS_VERSION } })),
    ).toMatch(/USER_ALREADY_EXISTS/);
  });
});

describe("aceite dos termos", () => {
  it("cria a conta só com a versão atual e grava a data do servidor", async () => {
    expect(
      await codeOf(auth.api.signUpEmail({ body: { name: "Sem", email: email(), password: "senha-forte-1" } })),
    ).toBe("TERMS_NOT_ACCEPTED");
    expect(
      await codeOf(
        auth.api.signUpEmail({ body: { name: "Velha", email: email(), password: "senha-forte-1", termsVersion: "2020-01-01" } }),
      ),
    ).toBe("TERMS_NOT_ACCEPTED");
    const result = await auth.api.signUpEmail({
      body: { name: "Com", email: email(), password: "senha-forte-1", termsVersion: TERMS_VERSION },
    });
    expect(result.user).toMatchObject({ termsVersion: TERMS_VERSION });
    expect((result.user as { termsAcceptedAt?: unknown }).termsAcceptedAt).toBeInstanceOf(Date);
  });

  it("não aceita versão errada ao atualizar a conta", async () => {
    const signUp = await auth.api.signUpEmail({
      body: { name: "Dani", email: email(), password: "senha-forte-1", termsVersion: TERMS_VERSION },
      returnHeaders: true,
    });
    // O cookie da sessão, como o navegador mandaria.
    const cookie = (signUp.headers.get("set-cookie") ?? "").split(";")[0];
    const headers = new Headers({ cookie });
    expect(await codeOf(auth.api.updateUser({ headers, body: { termsVersion: "2020-01-01" } }))).toBe("TERMS_NOT_ACCEPTED");
    expect(await codeOf(auth.api.updateUser({ headers, body: { termsVersion: TERMS_VERSION } }))).toBe("ok");
  });
});

describe("regras da conta pela API (lib/auth-guard.ts)", () => {
  const ORIGIN = "http://localhost:3000";
  const post = async (path: string, body: object, cookie?: string) => {
    const response = await auth.handler(
      new Request(`${ORIGIN}/api/auth/${path}`, {
        method: "POST",
        headers: { host: "localhost:3000", origin: ORIGIN, "content-type": "application/json", ...(cookie && { cookie }) },
        body: JSON.stringify(body),
      }),
    );
    const json = (await response.json().catch(() => null)) as { code?: string } | null;
    return { status: response.status, code: json?.code, cookie: response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
  };
  const signUp = (name = "Eva", address = email()) =>
    post("sign-up/email", { name, email: address, password: "senha-forte-1", termsVersion: TERMS_VERSION });

  it("recusa nome grande demais no cadastro e na edição", async () => {
    expect((await signUp("a".repeat(200_000))).code).toBe("INVALID_NAME");
    const { cookie } = await signUp();
    expect((await post("update-user", { name: "a".repeat(500_000) }, cookie)).code).toBe("INVALID_NAME");
  });

  it("excluir a conta pede a senha, mesmo com a sessão recém-criada", async () => {
    const address = email();
    const { cookie } = await signUp("Fábio", address);
    expect((await post("delete-user", {}, cookie)).code).toBe("PASSWORD_REQUIRED");
    expect((await post("delete-user", { password: "errada-123" }, cookie)).code).toBe("INVALID_PASSWORD");
    expect(await codeOf(auth.api.signInEmail({ body: { email: address, password: "senha-forte-1" } }))).toBe("ok");
    expect((await post("delete-user", { password: "senha-forte-1" }, cookie)).status).toBe(200);
    expect(await codeOf(auth.api.signInEmail({ body: { email: address, password: "senha-forte-1" } }))).toBe(
      "INVALID_EMAIL_OR_PASSWORD",
    );
  });
});
