import { collectErrors, expect, json, staffLogin, test } from "./fixtures";

test("o gerente cria e tira mesas do salão e ajusta o mapa", async ({ page, restaurant }) => {
  const { api } = restaurant;
  await staffLogin(page.request, restaurant, "manager");
  await page.goto(restaurant.screen("gerente"));
  const errors = collectErrors(page);
  await page.getByRole("button", { name: "Ajustes" }).click();

  // Mesa nova: aparece na lista, nos QR codes e já pode ser aberta pelo cliente.
  const newTable = page.getByRole("form", { name: "Nova mesa" });
  await newTable.getByLabel("Nova mesa").fill("Varanda");
  await newTable.getByRole("button", { name: "Criar mesa" }).click();
  const tables = page.getByRole("list", { name: "Mesas" });
  await expect(tables.getByText("Varanda", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code da Varanda/ })).toHaveCount(1);

  // Tira a Mesa 8 do salão: some da lista, dos QR codes e do endereço do QR.
  const mesa8 = restaurant.table("Mesa 8");
  await page.getByRole("button", { name: "Tirar Mesa 8 do salão" }).click();
  await page.getByRole("button", { name: "Confirmar: tirar Mesa 8 do salão" }).click();
  await expect(tables.getByText("Mesa 8", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /QR code da/ })).toHaveCount(8);
  expect(await (await page.request.get(api(`/api/tables/${mesa8}`))).json()).toMatchObject({ table: null });

  // Mesa aberta não sai do salão.
  const opened = await page.request.post(api("/api/staff/sessions?role=manager"), json({ tableId: restaurant.table("Mesa 1") }));
  expect(opened.ok()).toBe(true);
  // A tela fica sabendo pela atualização automática.
  await expect(page.getByRole("button", { name: "Tirar Mesa 1 do salão" })).toBeDisabled({ timeout: 10_000 });

  // Mapa: põe a Varanda no mapa, tira a entrada e salva.
  await page.getByLabel("Adicionar ao mapa").selectOption({ label: "Varanda" });
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Mover para a esquerda" }).click();
  await page.getByRole("button", { name: "Entrada", exact: true }).click();
  await page.getByRole("button", { name: "Tirar do mapa" }).click();
  await page.getByRole("button", { name: "Salvar mapa" }).click();
  // Salvo e relido do servidor: o aviso de mudanças pendentes some (o botão também fica desabilitado
  // durante o envio, então ele sozinho não prova que terminou).
  await expect(page.getByText("Há mudanças não salvas.")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Salvar mapa" })).toBeDisabled();

  const overview = await (await page.request.get(api("/api/staff/overview?role=manager"))).json();
  const varanda = overview.mapSpots.find((spot: { label: string }) => spot.label === "Varanda");
  expect(varanda).toMatchObject({ kind: "table", x: 42, y: 44 });
  expect(overview.mapSpots.some((spot: { kind: string }) => spot.kind === "entrance")).toBe(false);
  expect(overview.mapSpots.some((spot: { tableId?: string }) => spot.tableId === mesa8)).toBe(false);
  expect(errors).toEqual([]);
});

test("só o gerente edita o salão", async ({ request, restaurant }) => {
  const body = json({ type: "save_table", label: "Mesa 99" });
  expect((await request.post(restaurant.api("/api/staff/floor?role=manager"), body)).status()).toBe(401);
  await staffLogin(request, restaurant, "waiter");
  expect((await request.post(restaurant.api("/api/staff/floor?role=waiter"), body)).status()).toBe(403);
});
