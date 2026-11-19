import { collectErrors, expect, test, title } from "./fixtures";

// Conta e endereço novos a cada execução: os testes podem rodar de novo contra o mesmo servidor.
const unique = () => `${Date.now() % 1e8}${Math.floor(Math.random() * 1e3)}`;

test("o dono cadastra o restaurante, entra como gerente pela conta e a equipe usa o PIN dele", async ({
  page,
  browser,
  restaurant,
}) => {
  const id = unique();
  const slug = `cantina-${id}`;
  const errors = collectErrors(page);

  await page.goto("/conta");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Diego");
  await page.getByLabel("E-mail").fill(`dono-${id}@exemplo.com`);
  await page.getByLabel("Senha").fill("senha-forte-1");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(title(page, "Olá, Diego")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Cadastre o seu restaurante" })).toBeVisible();
  await page.getByLabel("Nome do restaurante").fill("Cantina Teste");
  await page.getByLabel("Endereço").fill(slug);
  await page.getByRole("button", { name: "Criar restaurante" }).click();

  const pinBox = page.getByRole("status", { name: "PIN de gerente de Cantina Teste" });
  await expect(pinBox).toBeVisible();
  const pin = (await pinBox.locator("p.font-mono").textContent())?.trim() ?? "";
  expect(pin).toMatch(/^\d{6}$/);
  await page.getByRole("button", { name: "Já anotei" }).click();
  await expect(page.getByRole("list", { name: "Seus restaurantes" })).toContainText(`/r/${slug}`);

  // Endereço já usado: o servidor explica.
  await page.getByLabel("Nome do restaurante").fill("Outra Cantina");
  await page.getByLabel("Endereço").fill(slug);
  await page.getByRole("button", { name: "Criar restaurante" }).click();
  await expect(page.getByRole("form", { name: "Cadastrar restaurante" }).getByRole("alert")).toHaveText(
    "Esse endereço já está em uso. Escolha outro.",
  );

  // Pela conta, o dono entra como gerente sem digitar o PIN.
  await page.getByRole("button", { name: "Abrir a tela do gerente de Cantina Teste" }).click();
  await expect(page).toHaveURL(`/r/${slug}/gerente`);
  await expect(page.getByRole("heading", { level: 1, name: "Gerente · Diego" })).toBeVisible();
  // Há erro esperado no console: o 409 do endereço repetido.
  expect(errors.filter((message) => !message.includes("409"))).toEqual([]);

  // Num aparelho do restaurante: o PIN de outro restaurante não entra; o do dono, sim.
  const device = await (await browser.newContext()).newPage();
  await device.goto(`/r/${slug}/garcom`);
  await device.getByLabel("PIN").fill(restaurant.pins.waiter);
  await device.getByRole("button", { name: "Entrar" }).click();
  await expect(device.getByText("PIN errado.")).toBeVisible();
  await device.getByLabel("PIN").fill(pin);
  await device.getByRole("button", { name: "Entrar" }).click();
  await expect(device.getByRole("heading", { level: 1, name: "Garçom · Diego" })).toBeVisible();
});
