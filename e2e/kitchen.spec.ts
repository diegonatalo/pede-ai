import { collectErrors, expect, joinAndOpenTab, json, openTable, staffLogin, tabsOf, test } from "./fixtures";

test("a cozinha e o bar preparam pela fila, e o cliente acompanha", async ({ browser, playwright, baseURL, restaurant }) => {
  const waiter = await playwright.request.newContext({ baseURL });
  await staffLogin(waiter, restaurant, "waiter");
  const { session, joinCode } = await openTable(waiter, restaurant, "Mesa 5");

  const customer = await (await browser.newContext()).newPage();
  await joinAndOpenTab(customer, restaurant, "Mesa 5", joinCode, "Dani");
  await customer.getByRole("button", { name: "Adicionar Caipirinha" }).click();
  await customer.getByRole("button", { name: "Adicionar Lasanha à bolonhesa" }).click();
  await customer.getByRole("button", { name: /Ver pedido/ }).click();
  await customer.getByLabel("Observação (opcional)").first().fill("pouco açúcar");
  await customer.getByRole("button", { name: "Enviar pedido" }).click();

  // O garçom confirma pela API (a tela dele tem o próprio teste).
  const dani = (await tabsOf(waiter, restaurant, session.id)).find((tab) => tab.customerName === "Dani");
  if (!dani) throw new Error("comanda da Dani não apareceu");
  expect((await waiter.post(restaurant.api(`/api/staff/tabs/${dani.id}/approve?role=waiter`), json({}))).ok()).toBe(true);

  const kitchen = await (await browser.newContext()).newPage();
  await kitchen.goto(restaurant.screen("cozinha"));
  await kitchen.getByLabel("PIN").fill(restaurant.pins.kitchen);
  await kitchen.getByRole("button", { name: "Entrar" }).click();
  await expect(kitchen.getByRole("heading", { name: /^Novos/ })).toBeVisible();
  const errors = collectErrors(kitchen);

  // Filtro por estação: o bar não vê a lasanha.
  await kitchen.getByRole("button", { name: "Bar", exact: true }).click();
  await expect(kitchen.getByRole("heading", { name: "1× Caipirinha" })).toBeVisible();
  await expect(kitchen.getByText("pouco açúcar")).toBeVisible();
  await expect(kitchen.getByRole("heading", { name: "1× Lasanha à bolonhesa" })).toHaveCount(0);
  await kitchen.getByRole("button", { name: "Tudo" }).click();
  await expect(kitchen.getByRole("heading", { name: "1× Lasanha à bolonhesa" })).toBeVisible();

  await kitchen.getByRole("button", { name: "Começar Caipirinha da Mesa 5" }).click();
  await expect(customer.getByText("Em preparo")).toBeVisible({ timeout: 10_000 });
  await kitchen.getByRole("button", { name: "Caipirinha da Mesa 5 está pronto" }).click();
  await expect(
    kitchen.getByRole("region", { name: /Prontos/ }).getByRole("heading", { name: "1× Caipirinha" }),
  ).toBeVisible();
  await expect(customer.getByText("Pronto", { exact: true })).toBeVisible({ timeout: 10_000 });

  // Esgotar tira o item do celular do cliente; voltar devolve.
  await kitchen.getByRole("button", { name: "Cardápio" }).click();
  await kitchen.getByRole("button", { name: "Esgotar Tiramisù" }).click();
  await customer.getByRole("button", { name: "Cardápio" }).click();
  const tiramisu = customer.getByRole("listitem").filter({ has: customer.getByRole("heading", { name: "Tiramisù" }) });
  await expect(tiramisu.getByText("Esgotado")).toBeVisible({ timeout: 10_000 });
  await kitchen.getByRole("button", { name: "Voltar Tiramisù ao cardápio" }).click();
  await expect(customer.getByRole("button", { name: "Adicionar Tiramisù" })).toBeVisible({ timeout: 10_000 });

  expect(errors).toEqual([]);

  // Fecha a mesa: a fila da cozinha só mostra mesas abertas.
  expect((await waiter.post(restaurant.api(`/api/staff/tabs/${dani.id}/status?role=waiter`), json({ to: "paid" }))).ok()).toBe(true);
  expect((await waiter.post(restaurant.api(`/api/staff/sessions/${session.id}/close?role=waiter`), json({}))).ok()).toBe(true);
  await expect(kitchen.getByRole("button", { name: "Fila" })).toBeVisible();
});
