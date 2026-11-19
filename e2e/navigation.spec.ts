import { collectErrors, expect, test, title } from "./fixtures";

const HOME = "O pedido sai da mesa e chega na cozinha. A conta sai certa para cada um.";

for (const { path, heading } of [
  { path: "/", heading: HOME },
  { path: "/conta", heading: "Entrar na sua conta" },
]) {
  test(`abre ${path} sem erros no console`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(path);
    await expect(title(page, heading)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("as telas de um restaurante abrem sem erros no console", async ({ page, restaurant }) => {
  const errors = collectErrors(page);
  for (const { path, heading } of [
    { path: restaurant.screen(`mesa/${restaurant.table("Mesa 1")}`), heading: "A mesa ainda não foi aberta" },
    { path: restaurant.screen("mesa/nao-existe"), heading: "Mesa não encontrada" },
    { path: restaurant.screen("garcom"), heading: "Garçom" },
    { path: restaurant.screen("cozinha"), heading: "Cozinha e bar" },
    { path: restaurant.screen("gerente"), heading: "Gerente" },
  ]) {
    await page.goto(path);
    await expect(title(page, heading)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("endereço desconhecido mostra a 404 e volta ao início", async ({ page }) => {
  const response = await page.goto("/nao-existe");
  expect(response?.status()).toBe(404);
  await expect(title(page, "Página não encontrada")).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page).toHaveURL("/");
  await expect(title(page, HOME)).toBeVisible();
});

test("os endereços da antiga demonstração não existem mais", async ({ request }) => {
  for (const path of ["/demo", "/garcom", "/cozinha", "/gerente", "/mesa/mesa-1"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
