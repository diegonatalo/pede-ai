import type { Page } from "@playwright/test";
import { collectErrors, expect, joinAndOpenTab, openTable, staffLogin, test } from "./fixtures";

/** Adiciona itens do cardápio e envia o pedido. */
const order = async (page: Page, items: string[]) => {
  for (const name of items) {
    const more = page.getByRole("button", { name: `Mais um ${name}` });
    if (await more.isVisible()) await more.click();
    else await page.getByRole("button", { name: `Adicionar ${name}` }).click();
  }
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.getByText("Pedido enviado!")).toBeVisible();
};

const totalOf = (page: Page, tabName: string) =>
  page.getByRole("article", { name: `Conta de ${tabName}` }).getByText("Total").locator("xpath=following-sibling::dd[1]");

test("dois casais e uma amiga na mesma mesa: comandas separadas e vinho dividido", async ({
  browser,
  playwright,
  baseURL,
  restaurant,
}) => {
  const staff = await playwright.request.newContext({ baseURL });
  await staffLogin(staff, restaurant, "waiter");
  const { joinCode } = await openTable(staff, restaurant, "Mesa 3");

  const couple1 = await (await browser.newContext()).newPage();
  const couple2 = await (await browser.newContext()).newPage();
  const friend = await (await browser.newContext()).newPage();
  const errors = collectErrors(couple1);

  await joinAndOpenTab(couple1, restaurant, "Mesa 3", joinCode, "Ana e Rui", 2);
  await joinAndOpenTab(couple2, restaurant, "Mesa 3", joinCode, "Bia e Leo", 2);
  await joinAndOpenTab(friend, restaurant, "Mesa 3", joinCode, "Lia");

  await order(couple1, ["Filé à parmegiana", "Vinho tinto (garrafa)"]); // 98,00 + 129,00
  await order(couple2, ["Lasanha à bolonhesa", "Lasanha à bolonhesa"]); // 2 × 62,00
  await order(friend, ["Risoto de cogumelos"]); // 64,00

  // O casal 1 divide o vinho: 2 partes para cada casal e 1 para a Lia.
  await couple1.getByRole("button", { name: "Conta" }).click();
  await couple1.getByRole("button", { name: "Dividir Vinho tinto (garrafa)" }).click();
  await couple1.getByLabel("Bia e Leo").check();
  await couple1.getByLabel("Lia").check();
  await couple1.getByRole("button", { name: "Uma parte a mais para Ana e Rui" }).click();
  await couple1.getByRole("button", { name: "Uma parte a mais para Bia e Leo" }).click();
  await couple1.getByRole("button", { name: "Salvar divisão" }).click();

  // 12900 em 2:2:1 → 5160 + 5160 + 2580. Taxa de 10% em cada comanda.
  await expect(totalOf(couple1, "Ana e Rui")).toHaveText(/164,56/); // (9800 + 5160) × 1,1
  await couple2.getByRole("button", { name: "Conta" }).click();
  await expect(totalOf(couple2, "Bia e Leo")).toHaveText(/193,16/, { timeout: 10_000 }); // (12400 + 5160) × 1,1
  await friend.getByRole("button", { name: "Conta" }).click();
  await expect(totalOf(friend, "Lia")).toHaveText(/98,78/, { timeout: 10_000 }); // (6400 + 2580) × 1,1
  await expect(friend.getByText("Dividido com Ana e Rui e Bia e Leo (sua parte: 1 de 5)")).toBeVisible();
  // A Lia vê o vinho dividido, mas não pode redividir o que não pediu.
  await expect(friend.getByRole("button", { name: "Dividir Vinho tinto (garrafa)" })).toHaveCount(0);

  // A Lia pede a conta; o garçom vê o chamado e o valor certo na mesa.
  await friend.getByRole("button", { name: "Pedir a conta de Lia" }).click();
  await expect(friend.getByText("Conta pedida. O garçom já vem.")).toBeVisible();

  const waiter = await (await browser.newContext()).newPage();
  await staffLogin(waiter.request, restaurant, "waiter");
  await waiter.goto(restaurant.screen("garcom"));
  // A Lia também aparece em "Confirmar pedidos" (primeiro pedido); aqui interessa o chamado.
  const calls = waiter.getByRole("region", { name: /Chamados/ });
  await expect(calls.getByRole("heading", { name: "Mesa 3 · Lia" })).toBeVisible();
  await expect(calls.getByText("Pedir a conta")).toBeVisible();
  await waiter.getByRole("button", { name: "Mesas" }).click();
  await expect(waiter.getByText(/Conta pedida · R\$\s98,78/)).toBeVisible();

  for (const name of ["Ana e Rui", "Bia e Leo", "Lia"]) {
    await waiter.getByRole("button", { name: `Marcar a comanda de ${name} (Mesa 3) como paga` }).click();
  }
  await expect(friend.getByText("Conta paga. Obrigado!")).toBeVisible({ timeout: 10_000 });
  await waiter.getByRole("button", { name: "Fechar a Mesa 3" }).click();
  await expect(couple1.getByRole("heading", { name: "Mesa fechada. Obrigado pela visita!" })).toBeVisible({
    timeout: 10_000,
  });

  expect(errors).toEqual([]);
});

test("chamar o garçom para tirar uma dúvida", async ({ browser, playwright, baseURL, restaurant }) => {
  const staff = await playwright.request.newContext({ baseURL });
  await staffLogin(staff, restaurant, "waiter");
  const { joinCode } = await openTable(staff, restaurant, "Mesa 7");
  const customer = await (await browser.newContext()).newPage();
  await joinAndOpenTab(customer, restaurant, "Mesa 7", joinCode, "Rafa");

  await customer.getByRole("button", { name: "Chamar", exact: true }).click();
  await customer.getByLabel("Recado (opcional)").fill("tem opção sem glúten?");
  await customer.getByRole("button", { name: "Chamar o garçom" }).click();
  await expect(customer.getByRole("status").filter({ hasText: "Chamando" })).toBeVisible();

  const waiter = await (await browser.newContext()).newPage();
  await staffLogin(waiter.request, restaurant, "waiter");
  await waiter.goto(restaurant.screen("garcom"));
  const card = waiter.getByRole("listitem").filter({ hasText: "tem opção sem glúten?" });
  await card.getByRole("button", { name: /Estou indo/ }).click();
  await expect(customer.getByText("O garçom está a caminho")).toBeVisible({ timeout: 10_000 });
  await card.getByRole("button", { name: /Resolvido/ }).click();
  await expect(customer.getByText("O garçom está a caminho")).toHaveCount(0, { timeout: 10_000 });
});
