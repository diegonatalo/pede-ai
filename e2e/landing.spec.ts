import { collectErrors, expect, test } from "./fixtures";

test("a página inicial apresenta o produto e leva ao cadastro", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "O pedido sai da mesa e chega na cozinha. A conta sai certa para cada um.",
  );
  // Fotos carregadas (o next/image serve versões otimizadas).
  const hero = page.locator("header img").first();
  await expect(hero).toHaveJSProperty("complete", true);
  expect(await hero.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  await page.getByRole("link", { name: "Ver como funciona" }).click();
  await expect(page).toHaveURL(/#como-funciona$/);
  await expect(page.getByRole("heading", { level: 2, name: "Do QR code à conta paga, todo mundo na mesma página" })).toBeInViewport();

  await page.getByRole("link", { name: "Criar conta grátis" }).first().click();
  await expect(page).toHaveURL("/entrar");
  await expect(page.getByRole("heading", { level: 1, name: "Entrar na sua conta" })).toBeVisible();
  await expect(page.getByRole("link", { name: /demonstração/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("no celular, a página inicial não rola para o lado", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(360);
});
