import { expect, json, staffLogin, test } from "./fixtures";

/**
 * Fluxo completo pela API, com aparelhos separados (cada `request.newContext` tem seus cookies).
 * Aqui o foco é a camada HTTP: cookies, JSON e permissões. As telas têm os próprios testes.
 */

test("cliente pede, cozinha prepara, garçom entrega e a mesa fecha", async ({ playwright, baseURL, restaurant }) => {
  const { api } = restaurant;
  const staff = await playwright.request.newContext({ baseURL });
  const phone = await playwright.request.newContext({ baseURL });
  const stranger = await playwright.request.newContext({ baseURL });
  const tableId = restaurant.table("Mesa 6");

  // O garçom e a cozinha entram no mesmo aparelho.
  await staffLogin(staff, restaurant, "waiter");
  await staffLogin(staff, restaurant, "kitchen");
  expect(await (await staff.get(api("/api/staff/me"))).json()).toEqual({ roles: ["kitchen", "waiter"] });

  const opened = await staff.post(api("/api/staff/sessions?role=waiter"), json({ tableId }));
  expect(opened.ok()).toBe(true);
  const { joinCode } = await opened.json();

  // Sem o código, nada feito.
  expect(await (await stranger.get(api("/api/customer"))).json()).toEqual({ state: "guest" });
  expect((await stranger.post(api(`/api/tables/${tableId}/join`), json({ code: "x" }))).status()).toBe(401);

  expect((await phone.post(api(`/api/tables/${tableId}/join`), json({ code: joinCode }))).ok()).toBe(true);
  const tab = await (await phone.post(api("/api/customer/tabs"), json({ customerName: "Ana", peopleCount: 1 }))).json();
  const placed = await phone.post(
    api("/api/customer/orders"),
    json({ tabId: tab.id, lines: [{ menuItemId: restaurant.item("Espaguete à carbonara"), quantity: 1 }] }),
  );
  const [item] = (await placed.json()).items;
  expect(item.status).toBe("awaiting_approval");

  // A cozinha não aprova; o garçom sim.
  expect((await staff.post(api(`/api/staff/tabs/${tab.id}/approve?role=kitchen`), json({}))).status()).toBe(403);
  expect((await staff.post(api(`/api/staff/tabs/${tab.id}/approve?role=waiter`), json({}))).ok()).toBe(true);

  for (const [role, to] of [
    ["kitchen", "preparing"],
    ["kitchen", "ready"],
    ["waiter", "picked_up"],
    ["waiter", "delivered"],
  ]) {
    const response = await staff.post(api(`/api/staff/items/${item.id}/status?role=${role}`), json({ to }));
    expect(response.ok(), `${role} → ${to}`).toBe(true);
  }

  const view = await (await phone.get(api("/api/customer"))).json();
  expect(view.items[0].status).toBe("delivered");

  expect((await phone.post(api(`/api/customer/tabs/${tab.id}/status`), json({ to: "bill_requested" }))).ok()).toBe(true);
  expect((await staff.post(api(`/api/staff/tabs/${tab.id}/status?role=waiter`), json({ to: "paid" }))).ok()).toBe(true);
  expect((await staff.post(api(`/api/staff/sessions/${view.session.id}/close?role=waiter`), json({}))).ok()).toBe(true);

  // Mesa fechada: o celular perde o acesso.
  expect(await (await phone.get(api("/api/customer"))).json()).toEqual({ state: "closed" });
  expect((await phone.post(api("/api/customer/orders"), json({ tabId: tab.id, lines: [] }))).status()).toBe(401);
});

test("rotas da equipe exigem PIN e papel", async ({ playwright, baseURL, restaurant }) => {
  const { api } = restaurant;
  const device = await playwright.request.newContext({ baseURL });
  expect((await device.get(api("/api/staff/overview?role=waiter"))).status()).toBe(401);
  expect((await device.post(api("/api/staff/login"), json({ role: "waiter", pin: "000000" }))).status()).toBe(401);
  await staffLogin(device, restaurant, "kitchen");
  expect((await device.get(api("/api/staff/overview?role=kitchen"))).ok()).toBe(true);
  expect((await device.get(api("/api/staff/overview?role=waiter"))).status()).toBe(401);
});

test("a API pede o restaurante", async ({ request }) => {
  const response = await request.get("/api/menu");
  expect(response.status()).toBe(404);
  expect(await response.json()).toMatchObject({ error: "restaurant_not_found" });
});

test("comandos sem JSON são recusados", async ({ request }) => {
  const response = await request.post("/api/staff/login?r=qualquer", {
    form: { role: "waiter", pin: "2222" },
  });
  expect(response.status()).toBe(415);
});

test("o cardápio reflete item esgotado na hora", async ({ playwright, baseURL, restaurant }) => {
  const { api } = restaurant;
  const kitchen = await playwright.request.newContext({ baseURL });
  await staffLogin(kitchen, restaurant, "kitchen");
  const pannaCotta = restaurant.item("Panna cotta");
  const response = await kitchen.post(api(`/api/staff/menu/${pannaCotta}/availability?role=kitchen`), json({ available: false }));
  expect(response.ok()).toBe(true);
  const menu = await (await kitchen.get(api("/api/menu"))).json();
  expect(menu.items.find((item: { id: string }) => item.id === pannaCotta).available).toBe(false);
});
