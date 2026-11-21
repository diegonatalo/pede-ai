import { collectErrors, expect, openOwnRestaurant, staffLogin, test } from "./fixtures";

test("o gerente muda o nome do restaurante", async ({ page, restaurant }) => {
  await staffLogin(page.request, restaurant, "manager");
  await page.goto(restaurant.screen("gerente"));
  const errors = collectErrors(page);
  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByLabel("Nome do restaurante").fill("Cantina da Esquina");
  await page.getByRole("button", { name: "Salvar ajustes" }).click();
  await expect(page.getByText("Ajustes salvos.")).toBeVisible();
  await expect(page.getByRole("banner").getByText("Cantina da Esquina")).toBeVisible();
  // O endereço continua o mesmo.
  expect((await (await page.request.get(restaurant.api("/api/menu"))).status())).toBe(200);
  expect(errors).toEqual([]);
});

test("o dono exclui um restaurante, que some de vez", async ({ page }) => {
  const { slug } = await openOwnRestaurant(page);
  await page.goto("/conta");
  await page.getByRole("button", { name: "Excluir Casa Teste" }).click();
  const form = page.getByRole("form", { name: "Excluir Casa Teste para sempre" });
  await expect(form.getByRole("button", { name: "Excluir para sempre" })).toBeDisabled();
  await form.getByLabel(/Para confirmar, digite/).fill(slug);
  await form.getByRole("button", { name: "Excluir para sempre" }).click();
  await expect(page.getByRole("heading", { name: "Cadastre o seu restaurante" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Seus restaurantes" })).toHaveCount(0);
  expect((await page.request.get(`/api/menu?r=${slug}`)).status()).toBe(404);
});

test("o dono exclui a conta com a senha, e os restaurantes vão junto", async ({ page }) => {
  const { slug, email, password } = await openOwnRestaurant(page);
  await page.goto("/conta");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  const form = page.getByRole("form", { name: "Excluir minha conta" });

  // Senha errada não apaga nada.
  await form.getByLabel("Sua senha").fill("senha-errada-1");
  await form.getByRole("button", { name: "Excluir conta para sempre" }).click();
  await expect(form.getByRole("alert")).toHaveText("Senha errada.");
  expect((await page.request.get(`/api/menu?r=${slug}`)).status()).toBe(200);

  await form.getByLabel("Sua senha").fill(password);
  await form.getByRole("button", { name: "Excluir conta para sempre" }).click();
  await expect(page).toHaveURL("/entrar");
  expect((await page.request.get(`/api/menu?r=${slug}`)).status()).toBe(404);

  // A conta não existe mais.
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await expect(page.getByText("E-mail ou senha errados.")).toBeVisible();
});
