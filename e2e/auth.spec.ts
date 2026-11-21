import type { Page } from "@playwright/test";
import { PASSWORD, collectErrors, expect, json, signUpByApi, test, title, uniqueEmail } from "./fixtures";

/** Preenche o cadastro na tela de entrar, com o aceite dos termos. */
const fillSignUp = async (page: Page, name: string, email: string) => {
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar minha conta" }).click();
};

/** Entra pela tela de entrar. */
const signIn = async (page: Page, email: string, password = PASSWORD) => {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar na conta" }).click();
};

test("sem login, a conta manda para entrar e volta para a página pedida", async ({ page, baseURL }) => {
  const email = await signUpByApi(page.request, baseURL!);
  await page.context().clearCookies();

  await page.goto("/conta");
  await expect(page).toHaveURL("/entrar");
  await expect(title(page, "Entrar na sua conta")).toBeVisible();

  await page.goto("/conta?aba=restaurantes");
  await expect(page).toHaveURL("/entrar?de=%2Fconta%3Faba%3Drestaurantes");
  await signIn(page, email);
  await expect(page).toHaveURL("/conta?aba=restaurantes");
});

test("o ?de= não leva para fora da conta", async ({ page, baseURL }) => {
  const email = await signUpByApi(page.request, baseURL!);
  await page.context().clearCookies();
  await page.goto("/entrar?de=https%3A%2F%2Fexemplo.com");
  await signIn(page, email);
  await expect(page).toHaveURL("/conta");
});

test("o dono cria a conta, sai e entra de novo", async ({ page }) => {
  const email = uniqueEmail();
  const errors = collectErrors(page);

  await page.goto("/entrar");
  await fillSignUp(page, "Diego", email);
  await expect(page).toHaveURL("/conta");
  await expect(title(page, "Olá, Diego")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // A sessão continua depois de recarregar (cookie do login).
  await page.reload();
  await expect(title(page, "Olá, Diego")).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL("/entrar");
  await page.goto("/conta");
  await expect(page).toHaveURL("/entrar");

  await signIn(page, email);
  await expect(page).toHaveURL("/conta");
  await expect(title(page, "Olá, Diego")).toBeVisible();

  expect(errors).toEqual([]);
});

test("só cria a conta depois de aceitar os termos", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Rita");
  await page.getByLabel("E-mail").fill(uniqueEmail());
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  // O navegador barra o envio: a caixa é obrigatória.
  await expect(title(page, "Criar sua conta")).toBeVisible();
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(title(page, "Olá, Rita")).toBeVisible();
});

test("a conta não é criada pela API sem o aceite dos termos", async ({ request, baseURL }) => {
  const response = await request.post("/api/auth/sign-up/email", {
    data: { name: "Sem aceite", email: uniqueEmail(), password: PASSWORD },
    headers: { "content-type": "application/json", origin: baseURL ?? "" },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).code).toBe("TERMS_NOT_ACCEPTED");
});

test("senha errada mostra o motivo e não entra", async ({ page, baseURL }) => {
  const email = await signUpByApi(page.request, baseURL!);
  await page.context().clearCookies();
  await page.goto("/entrar");
  await signIn(page, email, "errada-123");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("E-mail ou senha errados.");
  await expect(page).toHaveURL("/entrar");
});

test("não cria duas contas com o mesmo e-mail", async ({ page, baseURL }) => {
  const email = await signUpByApi(page.request, baseURL!);
  await page.context().clearCookies();
  await page.goto("/entrar");
  await fillSignUp(page, "Outra pessoa", email);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Já existe uma conta com este e-mail");
  await expect(page).toHaveURL("/entrar");
});

test("uma conta não vê nem mexe nos restaurantes de outra", async ({ browser, baseURL, restaurant }) => {
  // `restaurant` é de outra conta, criada pelo fixture.
  const other = await browser.newContext({ baseURL });
  const page = await other.newPage();
  await signUpByApi(page.request, baseURL!, { name: "Bia" });

  await page.goto("/conta");
  await expect(title(page, "Olá, Bia")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cadastre o seu restaurante" })).toBeVisible();
  await expect(page.getByText(`/r/${restaurant.slug}`)).toHaveCount(0);
  expect(await (await page.request.get("/api/account/restaurants")).text()).not.toContain(restaurant.slug);

  // Entrar como dono ou excluir o restaurante dos outros responde como se ele não existisse.
  const enter = await page.request.post("/api/account/restaurants/enter", json({ slug: restaurant.slug }));
  expect(enter.status()).toBe(404);
  const removed = await page.request.post(
    "/api/account/restaurants/delete",
    json({ slug: restaurant.slug, confirm: restaurant.slug }),
  );
  expect(removed.status()).toBe(404);
  expect((await page.request.get(restaurant.api("/api/menu"))).status()).toBe(200);
  await other.close();
});

test("o dono exclui a conta com a senha e não consegue mais entrar", async ({ page, baseURL }) => {
  const email = await signUpByApi(page.request, baseURL!, { name: "Caio" });
  await page.goto("/conta");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  const form = page.getByRole("form", { name: "Excluir minha conta" });
  await form.getByLabel("Sua senha").fill(PASSWORD);
  await form.getByRole("button", { name: "Excluir conta para sempre" }).click();
  await expect(page).toHaveURL("/entrar");

  await page.goto("/conta");
  await expect(page).toHaveURL("/entrar");
  await signIn(page, email);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("E-mail ou senha errados.");
});
