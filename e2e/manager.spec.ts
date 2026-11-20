import type { Page } from "@playwright/test";
import { collectErrors, expect, json, staffLogin, test, title } from "./fixtures";

const baseURLOf = (page: Page) => new URL(page.url()).origin;

test("o gerente vê o salão, os números do dia e os ajustes", async ({ page, restaurant }) => {
  await page.goto(restaurant.screen("gerente"));
  await expect(title(page, "Gerente")).toBeVisible();
  await page.getByLabel("PIN").fill(restaurant.pins.manager);
  await page.getByRole("button", { name: "Entrar" }).click();
  const errors = collectErrors(page);

  // Salão: resumo e as 8 mesas do salão de exemplo.
  await expect(page.getByText(/de 8 mesas ocupadas/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir a Mesa 1" })).toBeVisible();

  await page.getByRole("button", { name: "Números" }).click();
  await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
  await expect(page.getByText("Faturamento")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mais pedidos" })).toBeVisible();

  // QR codes, nos ajustes: um por mesa, com o link da tela do cliente (aqui, o servidor local do teste).
  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(page.getByRole("img", { name: /QR code da Mesa/ })).toHaveCount(8);
  await expect(page.getByText(`${baseURLOf(page)}${restaurant.screen(`mesa/${restaurant.table("Mesa 1")}`)}`)).toBeVisible();
  await expect(page.getByText("só funciona neste computador", { exact: false })).toBeVisible();

  // Configuração de fábrica do restaurante novo; salvar confere o caminho todo.
  await expect(page.getByLabel("Taxa de serviço (%)")).toHaveValue("10");
  await expect(page.getByLabel("Couvert por pessoa (R$)")).toHaveValue("0,00");
  await expect(page.getByRole("checkbox", { name: /Garçom confirma o primeiro pedido/ })).toBeChecked();
  await page.getByRole("button", { name: "Salvar ajustes" }).click();
  await expect(page.getByText("Ajustes salvos.")).toBeVisible();

  expect(errors).toEqual([]);
});

test("o relatório e os ajustes são só do gerente", async ({ request, restaurant }) => {
  await staffLogin(request, restaurant, "waiter");
  const report = await request.get(restaurant.api("/api/staff/report?role=waiter&since=2026-01-01T00:00:00.000Z"));
  expect(report.status()).toBe(403);
  const patch = await request.patch(restaurant.api("/api/staff/restaurant?role=waiter"), {
    data: { serviceFeePercent: 30 },
    headers: { "content-type": "application/json" },
  });
  expect(patch.status()).toBe(403);
});

test("o gerente escolhe o período e baixa as planilhas", async ({ page, playwright, baseURL, restaurant }) => {
  const { api } = restaurant;
  // Um pedido de hoje: o garçom abre a mesa e lança pela própria tela (pela API).
  const staff = await playwright.request.newContext({ baseURL });
  await staffLogin(staff, restaurant, "waiter");
  const opened = await staff.post(api("/api/staff/sessions?role=waiter"), json({ tableId: restaurant.table("Mesa 3") }));
  const { session } = await opened.json();
  const tab = await (await staff.post(api("/api/staff/tabs?role=waiter"), json({ sessionId: session.id, customerName: "Ana", peopleCount: 2 }))).json();
  await staff.post(api("/api/staff/orders?role=waiter"), json({ tabId: tab.id, lines: [{ menuItemId: restaurant.item("Chope"), quantity: 2 }] }));

  await staffLogin(page.request, restaurant, "manager");
  await page.goto(restaurant.screen("gerente"));
  const errors = collectErrors(page);
  await page.getByRole("button", { name: "Números" }).click();
  await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
  await expect(page.getByText("Itens vendidos").locator("..").getByText("2", { exact: true })).toBeVisible();

  // Ontem não teve nada: as planilhas ficam sem o que baixar.
  await page.getByRole("button", { name: "Ontem" }).click();
  await expect(page.getByRole("heading", { name: "Ontem" })).toBeVisible();
  await expect(page.getByText("Nenhum item vendido neste período.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Baixar itens (CSV)" })).toBeDisabled();

  await page.getByRole("button", { name: "Últimos 7 dias" }).click();
  await expect(page.getByRole("heading", { name: "Últimos 7 dias" })).toBeVisible();
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Baixar itens (CSV)" }).click(),
  ]);
  expect(file.suggestedFilename()).toMatch(/^pede-ai-itens-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.csv$/);
  const content = (await (await file.createReadStream()).toArray()).join("");
  const lines = content.replace(/^﻿/, "").trim().split("\r\n");
  expect(lines[0]).toBe("Data;Hora;Mesa;Comanda;Item;Preparo;Quantidade;Preço unitário (R$);Total (R$);Situação");
  expect(lines[1]).toMatch(/;Mesa 3;Ana;Chope;Bar;2;13,00;26,00;/);
  expect(errors).toEqual([]);
});
