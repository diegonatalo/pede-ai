import type { Page } from "@playwright/test";
import { collectErrors, expect, test } from "./fixtures";

const loginOnScreen = async (page: Page, path: string, pin: string) => {
  await page.goto(path);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Entrar" }).click();
};

test("o gerente cadastra um garçom, que entra com o próprio PIN e perde o acesso ao ser desativado", async ({
  browser,
  restaurant,
}) => {
  const name = "Bruno";
  const manager = await (await browser.newContext()).newPage();
  await loginOnScreen(manager, restaurant.screen("gerente"), restaurant.pins.manager);
  await expect(manager.getByRole("heading", { level: 1, name: `Gerente · ${restaurant.ownerName}` })).toBeVisible();
  const errors = collectErrors(manager);

  await manager.getByRole("button", { name: "Equipe" }).click();
  await manager.getByLabel("Nome").fill(name);
  await manager.getByLabel("Papel").selectOption("waiter");
  await manager.getByRole("button", { name: "Cadastrar" }).click();
  const pinBox = manager.getByRole("status", { name: `PIN de ${name}` });
  await expect(pinBox).toBeVisible();
  const pin = (await pinBox.locator("p.font-mono").textContent())?.trim() ?? "";
  expect(pin).toMatch(/^\d{6}$/);
  await manager.getByRole("button", { name: "Já anotei" }).click();
  await expect(pinBox).toHaveCount(0);

  // O garçom novo entra no próprio aparelho e aparece pelo nome.
  const waiter = await (await browser.newContext()).newPage();
  await loginOnScreen(waiter, restaurant.screen("garcom"), pin);
  await expect(waiter.getByRole("heading", { level: 1, name: `Garçom · ${name}` })).toBeVisible();

  // Desativado: perde o acesso na hora, mesmo com o cookie ainda válido.
  await manager.getByRole("button", { name: `Desativar ${name}` }).click();
  await expect(manager.getByText(`Garçom · desativado`).first()).toBeVisible();
  await waiter.reload();
  await expect(waiter.getByLabel("PIN")).toBeVisible();
  await waiter.getByLabel("PIN").fill(pin);
  await waiter.getByRole("button", { name: "Entrar" }).click();
  await expect(waiter.getByText("PIN errado.")).toBeVisible();

  expect(errors).toEqual([]);
});

test("o PIN do garçom não abre a tela do gerente", async ({ page, restaurant }) => {
  await loginOnScreen(page, restaurant.screen("gerente"), restaurant.pins.waiter);
  await expect(page.getByText("Este PIN não dá acesso a esta tela.", { exact: false })).toBeVisible();
});

test("o gerente pode usar a tela do garçom com o próprio PIN", async ({ page, restaurant }) => {
  await loginOnScreen(page, restaurant.screen("garcom"), restaurant.pins.manager);
  await expect(page.getByRole("heading", { level: 1, name: `Garçom · ${restaurant.ownerName}` })).toBeVisible();
});
