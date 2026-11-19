import { expect, test, type Page } from "@playwright/test";
import { collectErrors, joinAndOpenTab, json, staffLogin, title } from "./fixtures";

/** Abre a mesa pela tela do garçom (ou reaproveita, numa nova tentativa) e lê o código mostrado. */
const openTableOnScreen = async (waiter: Page, label: string) => {
  await waiter.getByRole("button", { name: "Mesas" }).click();
  const open = waiter.getByRole("button", { name: `Abrir a ${label}` });
  if (await open.isVisible()) await open.click();
  const code = waiter.getByLabel(new RegExp(`^Código da ${label}:`));
  await expect(code).toBeVisible();
  return (await code.textContent())?.trim() ?? "";
};

test("o garçom abre a mesa, confirma, entrega, recebe e fecha", async ({ browser, playwright, baseURL }) => {
  const waiter = await (await browser.newContext()).newPage();
  const customer = await (await browser.newContext()).newPage();

  // Login: PIN errado é recusado; o certo abre a tela.
  await waiter.goto("/garcom");
  await expect(title(waiter, "Garçom")).toBeVisible();
  await waiter.getByLabel("PIN").fill("9999");
  await waiter.getByRole("button", { name: "Entrar" }).click();
  await expect(waiter.getByText("PIN errado.")).toBeVisible();
  await waiter.getByLabel("PIN").fill("2222");
  await waiter.getByRole("button", { name: "Entrar" }).click();
  await expect(waiter.getByRole("button", { name: "Agora" })).toBeVisible();
  // Daqui em diante, nenhum erro no console (o 401 do PIN errado acima é esperado).
  const errors = collectErrors(waiter);

  const code = await openTableOnScreen(waiter, "Mesa 2");
  expect(code).toMatch(/^\d{4}$/);

  await joinAndOpenTab(customer, "mesa-2", code, "Bruno");
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
  await staffLogin(kitchen, "kitchen");
  const view = await (await customer.request.get("/api/customer")).json();
  const chope = view.items.find((item: { menuItemId: string }) => item.menuItemId === "chope");
  for (const to of ["preparing", "ready"]) {
    expect((await kitchen.post(`/api/staff/items/${chope.id}/status?role=kitchen`, json({ to }))).ok()).toBe(true);
  }

  await waiter.getByRole("button", { name: "Retirei Chope da Mesa 2" }).click({ timeout: 10_000 });
  await waiter.getByRole("button", { name: "Entreguei Chope da Mesa 2" }).click();
  await expect(customer.getByText("Entregue", { exact: true })).toBeVisible({ timeout: 10_000 });

  // Recebe e fecha a mesa; o celular do cliente fica sabendo.
  await waiter.getByRole("button", { name: "Mesas" }).click();
  await waiter.getByRole("button", { name: "Marcar a comanda de Bruno como paga" }).click();
  await waiter.getByRole("button", { name: "Fechar a Mesa 2" }).click();
  await expect(waiter.getByRole("button", { name: "Abrir a Mesa 2" })).toBeVisible();
  await expect(customer.getByRole("heading", { name: "Mesa fechada. Obrigado pela visita!" })).toBeVisible({
    timeout: 10_000,
  });

  expect(errors).toEqual([]);
});

test("o login vale para o navegador até sair", async ({ page }) => {
  await staffLogin(page.request, "waiter");
  await page.goto("/garcom");
  await expect(page.getByRole("button", { name: "Agora" })).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByLabel("PIN")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("PIN")).toBeVisible();
});
