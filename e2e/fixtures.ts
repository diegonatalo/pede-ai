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
