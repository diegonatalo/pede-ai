import { expect, test } from "@playwright/test";
import { collectErrors, joinAndOpenTab, json, openTable, staffLogin, tabIdsOf } from "./fixtures";

// Os testes rodam em paralelo contra o mesmo servidor: cada um usa a própria mesa.

test("dois aparelhos na mesma mesa, cada um com a sua comanda", async ({ browser, playwright, baseURL }) => {
  const staff = await playwright.request.newContext({ baseURL });
  await staffLogin(staff, "waiter");
  await staffLogin(staff, "kitchen");
  const { session, joinCode } = await openTable(staff, "mesa-4");

  const couple = await (await browser.newContext()).newPage();
  const friend = await (await browser.newContext()).newPage();
  const errors = collectErrors(couple);

  await joinAndOpenTab(couple, "mesa-4", joinCode, "Ana e Rui", 2);
  await couple.getByRole("button", { name: "Adicionar Burrata" }).click();
  await couple.getByRole("button", { name: "Adicionar Chope" }).click();
  await couple.getByRole("button", { name: "Mais um Chope" }).click();
  await couple.getByRole("button", { name: /Ver pedido \(3\)/ }).click();
  await couple.getByLabel("Observação (opcional)").first().fill("com pão extra");
  await couple.getByRole("button", { name: "Enviar pedido" }).click();

  await expect(couple.getByText("Pedido enviado!")).toBeVisible();
  await expect(couple.getByText("com pão extra")).toBeVisible();
  await expect(couple.getByText("Aguardando o garçom")).toHaveCount(2);

  await joinAndOpenTab(friend, "mesa-4", joinCode, "Lia");
  await friend.getByRole("button", { name: "Adicionar Risoto de cogumelos" }).click();
  await friend.getByRole("button", { name: /Ver pedido/ }).click();
  await friend.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(friend.getByText("1× Risoto de cogumelos")).toBeVisible();
  // Cada um vê só os próprios pedidos.
  await expect(friend.getByText("Burrata")).toHaveCount(0);
  await expect(couple.getByText("Risoto de cogumelos")).toHaveCount(0);

  // A comanda e o item vêm do próprio celular (page.request usa os cookies dele): a mesa pode
  // ter comandas de outras rodadas do teste.
  const coupleView = await (await couple.request.get("/api/customer")).json();
  const coupleTab = coupleView.tabs.find((tab: { mine: boolean }) => tab.mine);
  const burrata = coupleView.items.find((item: { menuItemId: string }) => item.menuItemId === "burrata");
  expect(coupleTab.customerName).toBe("Ana e Rui");
  expect((await tabIdsOf(staff, session.id)).map((tab: { id: string }) => tab.id)).toContain(coupleTab.id);

  // O garçom confirma a comanda do casal e a cozinha começa um item: o celular atualiza sozinho.
  expect((await staff.post(`/api/staff/tabs/${coupleTab.id}/approve?role=waiter`, json({}))).ok()).toBe(true);
  await expect(couple.getByText("Na fila")).toHaveCount(2, { timeout: 10_000 });
  await staff.post(`/api/staff/items/${burrata.id}/status?role=kitchen`, json({ to: "preparing" }));
  await expect(couple.getByText("Em preparo")).toBeVisible({ timeout: 10_000 });

  // Recarregar não perde nada: a mesa e a comanda ficam no cookie, os pedidos no servidor.
  await couple.reload();
  await couple.getByRole("button", { name: "Pedidos" }).click();
  await expect(couple.getByText("Em preparo")).toBeVisible();
  await expect(couple.getByRole("combobox", { name: "Comanda" })).toHaveValue(coupleTab.id);

  expect(errors).toEqual([]);
});

test("cancela um item antes do preparo", async ({ page, playwright, baseURL }) => {
  const staff = await playwright.request.newContext({ baseURL });
  await staffLogin(staff, "waiter");
  const { joinCode } = await openTable(staff, "mesa-7");

  await joinAndOpenTab(page, "mesa-7", joinCode, "Caio");
  await page.getByRole("button", { name: "Adicionar Café espresso" }).click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await page.getByRole("button", { name: "Cancelar Café espresso" }).click();
  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar Café espresso" })).toHaveCount(0);
});

test("código errado não entra na mesa", async ({ page, playwright, baseURL }) => {
  const staff = await playwright.request.newContext({ baseURL });
  await staffLogin(staff, "waiter");
  const { joinCode } = await openTable(staff, "mesa-8");
  const wrong = joinCode === "0000" ? "1111" : "0000";

  await page.goto("/mesa/mesa-8");
  await page.getByLabel("Código da mesa").fill(wrong);
  await page.getByRole("button", { name: "Entrar na mesa" }).click();
  // Por texto: o Next também põe um role="alert" na página (o anunciador de rotas).
  await expect(page.getByText("Código errado. Confira com o garçom.")).toBeVisible();
  await expect(page.getByLabel("Como podemos te chamar?")).toHaveCount(0);
});

test("o cliente acha a mesa, o banheiro e o caixa no mapa", async ({ page, playwright, baseURL }) => {
  const staff = await playwright.request.newContext({ baseURL });
  await staffLogin(staff, "waiter");
  const { joinCode } = await openTable(staff, "mesa-7");

  await joinAndOpenTab(page, "mesa-7", joinCode, "Gabi");
  await page.getByRole("button", { name: "Onde fica?" }).click();
  await expect(page.getByRole("heading", { name: "Mapa do salão" })).toBeVisible();
  await expect(page.getByText("Sua mesa: Mesa 7, no meio do salão, à direita.")).toBeVisible();
  await expect(page.getByText("Banheiros:").locator("..")).toHaveText("Banheiros: ao fundo, à direita.");
  await expect(page.getByText("Caixa:").locator("..")).toHaveText("Caixa: perto da entrada, à esquerda.");
});
