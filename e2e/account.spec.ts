import { collectErrors, expect, test, title } from "./fixtures";

// E-mail novo a cada execução: os testes podem rodar de novo contra o mesmo servidor.
const email = () => `dono-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.com`;

test("o dono cria a conta, sai e entra de novo", async ({ page }) => {
  const address = email();
  const errors = collectErrors(page);

  await page.goto("/conta");
  await expect(title(page, "Entrar na sua conta")).toBeVisible();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Diego");
  await page.getByLabel("E-mail").fill(address);
  await page.getByLabel("Senha").fill("senha-forte-1");
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar minha conta" }).click();

  await expect(title(page, "Olá, Diego")).toBeVisible();
  await expect(page.getByText(address)).toBeVisible();

  // A sessão continua depois de recarregar (cookie do login).
  await page.reload();
  await expect(title(page, "Olá, Diego")).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(title(page, "Entrar na sua conta")).toBeVisible();
  await page.getByLabel("E-mail").fill(address);
  await page.getByLabel("Senha").fill("senha-forte-1");
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await expect(title(page, "Olá, Diego")).toBeVisible();

  expect(errors).toEqual([]);
});

test("só cria a conta depois de aceitar os termos", async ({ page }) => {
  await page.goto("/conta");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Rita");
  await page.getByLabel("E-mail").fill(email());
  await page.getByLabel("Senha").fill("senha-forte-1");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  // O navegador barra o envio: a caixa é obrigatória.
  await expect(title(page, "Criar sua conta")).toBeVisible();
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(title(page, "Olá, Rita")).toBeVisible();
});

test("a conta não é criada pela API sem o aceite dos termos", async ({ request, baseURL }) => {
  const response = await request.post("/api/auth/sign-up/email", {
    data: { name: "Sem aceite", email: email(), password: "senha-forte-1" },
    headers: { "content-type": "application/json", origin: baseURL ?? "" },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).code).toBe("TERMS_NOT_ACCEPTED");
});

test("senha errada e e-mail repetido mostram o motivo", async ({ page, browser }) => {
  const address = email();
  await page.goto("/conta");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Ana");
  await page.getByLabel("E-mail").fill(address);
  await page.getByLabel("Senha").fill("senha-forte-1");
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(title(page, "Olá, Ana")).toBeVisible();

  const other = await (await browser.newContext()).newPage();
  await other.goto("/conta");
  await other.getByLabel("E-mail").fill(address);
  await other.getByLabel("Senha").fill("errada-123");
  await other.getByRole("button", { name: "Entrar na conta" }).click();
  await expect(other.getByText("E-mail ou senha errados.")).toBeVisible();

  await other.getByRole("button", { name: "Criar conta" }).click();
  await other.getByLabel("Seu nome").fill("Outra Ana");
  await other.getByLabel("E-mail").fill(address);
  await other.getByLabel("Senha").fill("senha-forte-2");
  await other.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await other.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(other.getByText(/Já existe uma conta com este e-mail/)).toBeVisible();
});
