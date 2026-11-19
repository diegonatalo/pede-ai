import { collectErrors, createRestaurant, expect, staffLogin, test } from "./fixtures";

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

test("o login da equipe num restaurante não abre as telas de outro", async ({ page, playwright, baseURL, restaurant }) => {
  const owner = await playwright.request.newContext({ baseURL });
  const other = await createRestaurant(owner, baseURL as string);
  await owner.dispose();
  const errors = collectErrors(page);

  await staffLogin(page.request, restaurant, "waiter");
  await page.goto(restaurant.screen("garcom"));
  await expect(page.getByRole("heading", { level: 1, name: /^Garçom · / })).toBeVisible();

  // Mesmo navegador, outro restaurante: pede o PIN de lá, e o daqui não serve.
  await page.goto(other.screen("garcom"));
  await expect(page.getByLabel("PIN")).toBeVisible();
  await page.getByLabel("PIN").fill(restaurant.pins.waiter);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("PIN errado.")).toBeVisible();

  // O primeiro continua aberto.
  await page.goto(restaurant.screen("garcom"));
  await expect(page.getByRole("heading", { level: 1, name: /^Garçom · / })).toBeVisible();
  // O único erro esperado é o 401 do PIN errado.
  expect(errors.filter((message) => !message.includes("401"))).toEqual([]);
});
