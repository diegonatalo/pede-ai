import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const title = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name, exact: true });

/** Junta os erros do console e da página para conferir no fim do teste. */
export const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

/** Opções de uma requisição JSON (os comandos da API só aceitam JSON). */
export const json = (data: unknown) => ({ data, headers: { "content-type": "application/json" } });

export const PINS = { kitchen: "1111", waiter: "2222", manager: "3333" } as const;

export const staffLogin = async (device: APIRequestContext, role: keyof typeof PINS) => {
  const response = await device.post("/api/staff/login", json({ role, pin: PINS[role] }));
  expect(response.ok()).toBe(true);
};

/**
 * O garçom abre a mesa e devolve o código para o cliente. Se a mesa já estiver aberta
 * (nova tentativa do mesmo teste contra o mesmo servidor), reaproveita a sessão.
 */
export const openTable = async (staff: APIRequestContext, tableId: string) => {
  const response = await staff.post("/api/staff/sessions?role=waiter", json({ tableId }));
  if (response.status() === 409) {
    const overview = await (await staff.get("/api/staff/overview?role=waiter")).json();
    const open = overview.sessions.find(
      (entry: { session: { tableId: string } }) => entry.session.tableId === tableId,
    );
    return { session: open.session, joinCode: overview.joinCodes[open.session.id] } as {
      session: { id: string };
      joinCode: string;
    };
  }
  expect(response.ok()).toBe(true);
  return (await response.json()) as { session: { id: string }; joinCode: string };
};

/**
 * Abre a mesa limpa: se ela ficou aberta de uma tentativa anterior, paga as comandas,
 * fecha e abre de novo. Para testes que contam comandas ou repetem nomes.
 */
export const openFreshTable = async (staff: APIRequestContext, tableId: string) => {
  const opened = await openTable(staff, tableId);
  const overview = await (await staff.get("/api/staff/overview?role=waiter")).json();
  const current = overview.sessions.find((entry: { session: { id: string } }) => entry.session.id === opened.session.id);
  if (current.tabs.length === 0) return opened;
  for (const tab of current.tabs as { id: string; status: string }[]) {
    if (tab.status === "open" || tab.status === "bill_requested") {
      await staff.post(`/api/staff/tabs/${tab.id}/status?role=waiter`, json({ to: "paid" }));
    }
  }
  expect((await staff.post(`/api/staff/sessions/${opened.session.id}/close?role=waiter`, json({}))).ok()).toBe(true);
  return openTable(staff, tableId);
};

/** Ids das comandas de uma mesa, na ordem em que foram abertas. */
export const tabIdsOf = async (staff: APIRequestContext, sessionId: string) => {
  const overview = await (await staff.get("/api/staff/overview?role=waiter")).json();
  const session = overview.sessions.find((entry: { session: { id: string } }) => entry.session.id === sessionId);
  return session.tabs.map((tab: { id: string; customerName: string }) => tab);
};

/** O cliente escaneia o QR, digita o código e abre a comanda. */
export const joinAndOpenTab = async (
  page: Page,
  tableId: string,
  joinCode: string,
  name: string,
  people = 1,
) => {
  await page.goto(`/mesa/${tableId}`);
  await page.getByLabel("Código da mesa").fill(joinCode);
  await page.getByRole("button", { name: "Entrar na mesa" }).click();
  await page.getByLabel("Como podemos te chamar?").fill(name);
  for (let count = 1; count < people; count += 1) {
    await page.getByRole("button", { name: "Uma pessoa a mais" }).click();
  }
  await page.getByRole("button", { name: "Abrir comanda" }).click();
  await expect(page.getByRole("searchbox", { name: "Buscar no cardápio" })).toBeVisible();
};

/**
 * Cria uma conta e um restaurante novos e entra na tela do gerente dele pela conta.
 * Para testes que mudam o cardápio ou o salão sem atrapalhar os que usam a demo em paralelo.
 */
export const openOwnRestaurant = async (page: Page) => {
  const id = `${Date.now() % 1e8}${Math.floor(Math.random() * 1e3)}`;
  const slug = `teste-${id}`;
  await page.goto("/conta");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Dona");
  await page.getByLabel("E-mail").fill(`dona-${id}@exemplo.com`);
  await page.getByLabel("Senha").fill("senha-forte-1");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await page.getByLabel("Nome do restaurante").fill("Casa Teste");
  await page.getByLabel("Endereço").fill(slug);
  await page.getByRole("button", { name: "Criar restaurante" }).click();
  await page.getByRole("button", { name: "Já anotei" }).click();
  await page.getByRole("button", { name: "Abrir a tela do gerente de Casa Teste" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Gerente · Dona" })).toBeVisible();
  return slug;
};
