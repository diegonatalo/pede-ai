import { expect, test } from "@playwright/test";
import { collectErrors, PINS, title } from "./fixtures";

test("a API recusa restaurante que não existe", async ({ request }) => {
  const response = await request.get("/api/menu?r=nao-existe");
  expect(response.status()).toBe(404);
  expect(await response.json()).toMatchObject({ error: "restaurant_not_found" });
});

test("as telas de um restaurante que não existe avisam pelo endereço", async ({ page }) => {
  await page.goto("/r/nao-existe/garcom");
  await expect(page.getByText("Restaurante não encontrado. Confira o endereço.")).toBeVisible();

  await page.goto("/r/nao-existe/mesa/mesa-1");
  await expect(page.getByText("Restaurante não encontrado. Confira o endereço.")).toBeVisible();
});

test("o início leva às telas da demonstração pelo endereço do restaurante", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Tela do garçom" }).click();
  await expect(page).toHaveURL("/r/demo/garcom");
  const errors = collectErrors(page);

  await page.getByLabel("PIN").fill(PINS.waiter);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^Garçom · / })).toBeVisible();

  // O endereço antigo é a mesma demonstração: quem entrou continua dentro.
  await page.goto("/garcom");
  await expect(page.getByRole("heading", { level: 1, name: /^Garçom · / })).toBeVisible();
  await expect(title(page, "Garçom")).toHaveCount(0);
  expect(errors).toEqual([]);
});
