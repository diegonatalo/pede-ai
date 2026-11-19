import type { Page } from "@playwright/test";
import { collectErrors, expect, joinAndOpenTab, json, staffLogin, test, title } from "./fixtures";

/** Abre a mesa pela tela do garçom e lê o código mostrado. */
const openTableOnScreen = async (waiter: Page, label: string) => {
  await waiter.getByRole("button", { name: "Mesas" }).click();
  await waiter.getByRole("button", { name: `Abrir a ${label}` }).click();
  const code = waiter.getByLabel(new RegExp(`^Código da ${label}:`));
  await expect(code).toBeVisible();
  return (await code.textContent())?.trim() ?? "";
};

test("o garçom abre a mesa, confirma, entrega, recebe e fecha", async ({ browser, playwright, baseURL, restaurant }) => {
  const waiter = await (await browser.newContext()).newPage();
  const customer = await (await browser.newContext()).newPage();

  // Login: PIN errado é recusado; o certo abre a tela.
  await waiter.goto(restaurant.screen("garcom"));
  await expect(title(waiter, "Garçom")).toBeVisible();
  await waiter.getByLabel("PIN").fill("999999");
  await waiter.getByRole("button", { name: "Entrar" }).click();
  await expect(waiter.getByText("PIN errado.")).toBeVisible();
  await waiter.getByLabel("PIN").fill(restaurant.pins.waiter);
  await waiter.getByRole("button", { name: "Entrar" }).click();
  await expect(waiter.getByRole("button", { name: "Agora" })).toBeVisible();
  // Daqui em diante, nenhum erro no console (o 401 do PIN errado acima é esperado).
  const errors = collectErrors(waiter);

  const code = await openTableOnScreen(waiter, "Mesa 2");
  expect(code).toMatch(/^\d{4}$/);

  await joinAndOpenTab(customer, restaurant, "Mesa 2", code, "Bruno");
  await customer.getByRole("button", { name: "Adicionar Chope" }).click();
  await customer.getByRole("button", { name: /Ver pedido/ }).click();
  await customer.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(customer.getByText("Aguardando o garçom")).toBeVisible();

  // O pedido aparece sozinho na aba Agora.
  await waiter.getByRole("button", { name: "Agora" }).click();
  await waiter.getByRole("button", { name: "Confirmar comanda de Bruno" }).click({ timeout: 10_000 });
  await expect(customer.getByText("Na fila")).toBeVisible({ timeout: 10_000 });

  // A cozinha (ainda sem tela) prepara pela API.
  const kitchen = await playwright.request.newContext({ baseURL });
  await staffLogin(kitchen, restaurant, "kitchen");
  const view = await (await customer.request.get(restaurant.api("/api/customer"))).json();
  const chope = view.items.find((item: { menuItemId: string }) => item.menuItemId === restaurant.item("Chope"));
  for (const to of ["preparing", "ready"]) {
    expect((await kitchen.post(restaurant.api(`/api/staff/items/${chope.id}/status?role=kitchen`), json({ to }))).ok()).toBe(true);
  }

  await waiter.getByRole("button", { name: "Retirei Chope da Mesa 2" }).click({ timeout: 10_000 });
  await waiter.getByRole("button", { name: "Entreguei Chope da Mesa 2" }).click();
  await expect(customer.getByText("Entregue", { exact: true })).toBeVisible({ timeout: 10_000 });

  // Recebe e fecha a mesa; o celular do cliente fica sabendo.
  await waiter.getByRole("button", { name: "Mesas" }).click();
  await waiter.getByRole("button", { name: "Marcar a comanda de Bruno (Mesa 2) como paga" }).click();
  await waiter.getByRole("button", { name: "Fechar a Mesa 2" }).click();
  await expect(waiter.getByRole("button", { name: "Abrir a Mesa 2" })).toBeVisible();
  await expect(customer.getByRole("heading", { name: "Mesa fechada. Obrigado pela visita!" })).toBeVisible({
    timeout: 10_000,
  });

  expect(errors).toEqual([]);
});

test("o login vale para o navegador até sair", async ({ page, restaurant }) => {
  await staffLogin(page.request, restaurant, "waiter");
  await page.goto(restaurant.screen("garcom"));
  await expect(page.getByRole("button", { name: "Agora" })).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByLabel("PIN")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("PIN")).toBeVisible();
});
