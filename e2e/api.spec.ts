import { expect, test } from "@playwright/test";
import { json, staffLogin } from "./fixtures";

/**
 * Fluxo completo pela API, com aparelhos separados (cada `request.newContext` tem seus cookies).
 * Aqui o foco é a camada HTTP: cookies, JSON e permissões. As telas têm os próprios testes.
 */

test("cliente pede, cozinha prepara, garçom entrega e a mesa fecha", async ({ playwright, baseURL }) => {
  const staff = await playwright.request.newContext({ baseURL });
  const phone = await playwright.request.newContext({ baseURL });
  const stranger = await playwright.request.newContext({ baseURL });

  // O garçom e a cozinha entram no mesmo navegador (a demo abre os dois).
  await staffLogin(staff, "waiter");
  await staffLogin(staff, "kitchen");
  expect(await (await staff.get("/api/staff/me")).json()).toEqual({ roles: ["kitchen", "waiter"] });

  const opened = await staff.post("/api/staff/sessions?role=waiter", json({ tableId: "mesa-6" }));
  expect(opened.ok()).toBe(true);
  const { joinCode } = await opened.json();

  // Sem o código, nada feito.
  expect(await (await stranger.get("/api/customer")).json()).toEqual({ state: "guest" });
  expect((await stranger.post("/api/tables/mesa-6/join", json({ code: "x" }))).status()).toBe(401);

  expect((await phone.post("/api/tables/mesa-6/join", json({ code: joinCode }))).ok()).toBe(true);
  const tab = await (await phone.post("/api/customer/tabs", json({ customerName: "Ana", peopleCount: 1 }))).json();
  const placed = await phone.post(
    "/api/customer/orders",
    json({ tabId: tab.id, lines: [{ menuItemId: "carbonara", quantity: 1 }] }),
  );
  const [item] = (await placed.json()).items;
  expect(item.status).toBe("awaiting_approval");

  // A cozinha não aprova; o garçom sim.
  expect((await staff.post(`/api/staff/tabs/${tab.id}/approve?role=kitchen`, json({}))).status()).toBe(403);
  expect((await staff.post(`/api/staff/tabs/${tab.id}/approve?role=waiter`, json({}))).ok()).toBe(true);

  for (const [role, to] of [
    ["kitchen", "preparing"],
    ["kitchen", "ready"],
    ["waiter", "picked_up"],
    ["waiter", "delivered"],
  ]) {
    const response = await staff.post(`/api/staff/items/${item.id}/status?role=${role}`, json({ to }));
    expect(response.ok(), `${role} → ${to}`).toBe(true);
  }

  const view = await (await phone.get("/api/customer")).json();
  expect(view.items[0].status).toBe("delivered");

  expect((await phone.post(`/api/customer/tabs/${tab.id}/status`, json({ to: "bill_requested" }))).ok()).toBe(true);
  expect((await staff.post(`/api/staff/tabs/${tab.id}/status?role=waiter`, json({ to: "paid" }))).ok()).toBe(true);
  expect((await staff.post(`/api/staff/sessions/${view.session.id}/close?role=waiter`, json({}))).ok()).toBe(true);

  // Mesa fechada: o celular perde o acesso.
  expect(await (await phone.get("/api/customer")).json()).toEqual({ state: "closed" });
  expect((await phone.post("/api/customer/orders", json({ tabId: tab.id, lines: [] }))).status()).toBe(401);
});

test("rotas da equipe exigem PIN e papel", async ({ playwright, baseURL }) => {
  const device = await playwright.request.newContext({ baseURL });
  expect((await device.get("/api/staff/overview?role=waiter")).status()).toBe(401);
  expect((await device.post("/api/staff/login", json({ role: "waiter", pin: "0000" }))).status()).toBe(401);
  await staffLogin(device, "kitchen");
  expect((await device.get("/api/staff/overview?role=kitchen")).ok()).toBe(true);
  expect((await device.get("/api/staff/overview?role=waiter")).status()).toBe(401);
});

test("comandos sem JSON são recusados", async ({ request }) => {
  const response = await request.post("/api/staff/login", {
    form: { role: "waiter", pin: "2222" },
  });
  expect(response.status()).toBe(415);
});

test("o cardápio reflete item esgotado na hora", async ({ playwright, baseURL }) => {
  const kitchen = await playwright.request.newContext({ baseURL });
  await staffLogin(kitchen, "kitchen");
  const response = await kitchen.post(
    "/api/staff/menu/panna-cotta/availability?role=kitchen",
    json({ available: false }),
  );
  expect(response.ok()).toBe(true);
  const menu = await (await kitchen.get("/api/menu")).json();
  expect(menu.items.find((item: { id: string }) => item.id === "panna-cotta").available).toBe(false);
});
