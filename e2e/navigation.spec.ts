import { expect, test } from "@playwright/test";
import { collectErrors, title } from "./fixtures";

const PAGES = [{ path: "/", heading: "Pede Aí" }];

for (const { path, heading } of PAGES) {
  test(`abre ${path} sem erros no console`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(path);
    await expect(title(page, heading)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("endereço desconhecido mostra a 404 e volta ao início", async ({ page }) => {
  const response = await page.goto("/nao-existe");
  expect(response?.status()).toBe(404);
  await expect(title(page, "Página não encontrada")).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page).toHaveURL("/");
  await expect(title(page, "Pede Aí")).toBeVisible();
});
