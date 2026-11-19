import { expect, test } from "@playwright/test";
import { collectErrors, staffLogin, title } from "./fixtures";

test("o gerente vê o salão, os números do dia e os ajustes", async ({ page }) => {
  await page.goto("/gerente");
  await expect(title(page, "Gerente")).toBeVisible();
  await page.getByLabel("PIN").fill("3333");
  await page.getByRole("button", { name: "Entrar" }).click();
  const errors = collectErrors(page);

  // Salão: resumo e as 8 mesas (a mesa 1 nunca é aberta pelos testes).
  await expect(page.getByText(/de 8 mesas ocupadas/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir a Mesa 1" })).toBeVisible();

  await page.getByRole("button", { name: "Números" }).click();
  await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
  await expect(page.getByText("Faturamento")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mais pedidos" })).toBeVisible();

  // QR codes: um por mesa, com o link da tela do cliente (aqui, o servidor local do teste).
  await page.getByRole("button", { name: "QR codes" }).click();
  await expect(page.getByRole("img", { name: /QR code da Mesa/ })).toHaveCount(8);
  await expect(page.getByText(/\/mesa\/mesa-1$/)).toBeVisible();
  await expect(page.getByText("só funciona neste computador", { exact: false })).toBeVisible();

  // Os outros testes rodam em paralelo contando com taxa de 10% e couvert zero:
  // aqui salva os mesmos valores, o que confere o caminho todo sem mudar a configuração.
  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(page.getByLabel("Taxa de serviço (%)")).toHaveValue("10");
  await expect(page.getByLabel("Couvert por pessoa (R$)")).toHaveValue("0,00");
  await expect(page.getByRole("checkbox", { name: /Garçom confirma o primeiro pedido/ })).toBeChecked();
  await page.getByRole("button", { name: "Salvar ajustes" }).click();
  await expect(page.getByText("Ajustes salvos.")).toBeVisible();

  expect(errors).toEqual([]);
});

test("o relatório e os ajustes são só do gerente", async ({ request }) => {
  await staffLogin(request, "waiter");
  expect((await request.get("/api/staff/report?role=waiter&since=2026-01-01T00:00:00.000Z")).status()).toBe(403);
  const patch = await request.patch("/api/staff/restaurant?role=waiter", {
    data: { serviceFeePercent: 30 },
    headers: { "content-type": "application/json" },
  });
  expect(patch.status()).toBe(403);
});
