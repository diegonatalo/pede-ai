import { expect, test } from "@playwright/test";
import { collectErrors } from "./fixtures";

test("a página inicial apresenta o produto e leva à conta e à demonstração", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "O pedido sai da mesa e chega na cozinha. A conta sai certa para cada um.",
  );
  // Fotos carregadas (o next/image serve versões otimizadas).
  const hero = page.locator("header img").first();
  await expect(hero).toHaveJSProperty("complete", true);
  expect(await hero.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { level: 2, name: "Do QR code à conta paga, todo mundo na mesma página" })).toBeVisible();

  await page.getByRole("link", { name: "Criar conta grátis" }).first().click();
  await expect(page).toHaveURL("/conta");
  await expect(page.getByRole("heading", { level: 1, name: "Entrar na sua conta" })).toBeVisible();

  await page.goBack();
  await page.getByRole("link", { name: "Ver a demonstração" }).first().click();
  await expect(page).toHaveURL("/demo");
  await expect(page.getByRole("heading", { level: 1, name: "Demonstração" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("no celular, a página inicial não rola para o lado", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(360);
});
