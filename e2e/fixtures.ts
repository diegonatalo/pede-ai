import { TERMS_VERSION } from "@/lib/terms";
import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

export { expect };

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

/** Identificador curto e único: os testes rodam em paralelo e podem repetir contra o mesmo servidor. */
export const uniqueId = () => `${Date.now() % 1e8}${Math.floor(Math.random() * 1e4)}`;

export const PASSWORD = "senha-forte-1";

/** E-mail único por teste: cada um começa com uma conta nova e vazia. */
export const uniqueEmail = () => `dono-${uniqueId()}@exemplo.com`;

/**
 * Cria uma conta pela API do Better Auth, com o aceite dos termos. A resposta já traz o
 * cookie de sessão, que fica no contexto do teste.
 */
export const signUpByApi = async (
  request: APIRequestContext,
  baseURL: string,
  { name = "Pessoa de Teste", email = uniqueEmail() }: { name?: string; email?: string } = {},
) => {
  const response = await request.post("/api/auth/sign-up/email", {
    data: { name, email, password: PASSWORD, termsVersion: TERMS_VERSION },
    headers: { "content-type": "application/json", origin: baseURL },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return email;
};

type StaffRole = "manager" | "waiter" | "kitchen";

/** Restaurante criado pelo fluxo real (conta + cadastro), só deste teste. */
export type TestRestaurant = {
  slug: string;
  /** Nome do dono, que é o gerente. */
  ownerName: string;
  /** PIN de cada papel: o do gerente é o do dono; garçom e cozinha são cadastrados pela equipe. */
  pins: Record<StaffRole, string>;
  staffNames: Record<StaffRole, string>;
  /** Id da mesa pelo nome mostrado ("Mesa 3"). */
  table: (label: string) => string;
  /** Id do item do cardápio pelo nome ("Chope"). */
  item: (name: string) => string;
  /** Caminho de uma tela do restaurante: `screen("garcom")` → `/r/<slug>/garcom`. */
  screen: (path: string) => string;
  /** Caminho da API com o restaurante (`?r=<slug>`). */
  api: (path: string) => string;
};

const withRestaurant = (path: string, slug: string) => `${path}${path.includes("?") ? "&" : "?"}r=${slug}`;

/**
 * Cria a conta do dono, o restaurante (que nasce com o salão e o cardápio de exemplo) e uma
 * pessoa de garçom e uma de cozinha, como um dono faria pela conta e pela tela de equipe.
 */
export const createRestaurant = async (owner: APIRequestContext, baseURL: string): Promise<TestRestaurant> => {
  const id = uniqueId();
  const slug = `teste-${id}`;
  const ownerName = "Dona";
  await signUpByApi(owner, baseURL, { name: ownerName, email: `dona-${id}@exemplo.com` });

  const created = await owner.post("/api/account/restaurants", json({ name: "Casa Teste", slug }));
  expect(created.ok(), await created.text()).toBe(true);
  const { pin: managerPin } = await created.json();

  const api = (path: string) => withRestaurant(path, slug);
  expect((await owner.post(api("/api/staff/login"), json({ role: "manager", pin: managerPin }))).ok()).toBe(true);
  const staffNames: Record<StaffRole, string> = { manager: ownerName, waiter: "Garçom Teste", kitchen: "Cozinha Teste" };
  const pins: Record<StaffRole, string> = { manager: managerPin, waiter: "", kitchen: "" };
  for (const role of ["waiter", "kitchen"] as const) {
    const member = await owner.post(api("/api/staff/team?role=manager"), json({ name: staffNames[role], role }));
    expect(member.ok(), await member.text()).toBe(true);
    pins[role] = (await member.json()).pin;
  }

  const overview = await (await owner.get(api("/api/staff/overview?role=manager"))).json();
  const tables = new Map<string, string>(overview.tables.map((table: { id: string; label: string }) => [table.label, table.id]));
  const items = new Map<string, string>(overview.menu.items.map((item: { id: string; name: string }) => [item.name, item.id]));
  const lookup = (map: Map<string, string>, kind: string) => (name: string) => {
    const found = map.get(name);
    if (!found) throw new Error(`${kind} "${name}" não existe no restaurante de teste`);
    return found;
  };

  return {
    slug,
    ownerName,
    pins,
    staffNames,
    table: lookup(tables, "mesa"),
    item: lookup(items, "item"),
    screen: (path) => `/r/${slug}/${path}`,
    api,
  };
};

/** `test` com um restaurante novo por teste (criado só quando o teste usa `restaurant`). */
export const test = base.extend<{ restaurant: TestRestaurant }>({
  // O Playwright chama o terceiro argumento de `use`; aqui `provide`, para não confundir com hooks do React.
  restaurant: async ({ playwright, baseURL }, provide) => {
    const owner = await playwright.request.newContext({ baseURL });
    const restaurant = await createRestaurant(owner, baseURL as string);
    await owner.dispose();
    await provide(restaurant);
  },
});

export const staffLogin = async (device: APIRequestContext, restaurant: TestRestaurant, role: StaffRole) => {
  const response = await device.post(restaurant.api("/api/staff/login"), json({ role, pin: restaurant.pins[role] }));
  expect(response.ok()).toBe(true);
};

/** O garçom abre a mesa e devolve o código para o cliente. */
export const openTable = async (staff: APIRequestContext, restaurant: TestRestaurant, label: string) => {
  const response = await staff.post(
    restaurant.api("/api/staff/sessions?role=waiter"),
    json({ tableId: restaurant.table(label) }),
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as { session: { id: string }; joinCode: string };
};

/** Comandas de uma mesa, na ordem em que foram abertas. */
export const tabsOf = async (staff: APIRequestContext, restaurant: TestRestaurant, sessionId: string) => {
  const overview = await (await staff.get(restaurant.api("/api/staff/overview?role=waiter"))).json();
  const session = overview.sessions.find((entry: { session: { id: string } }) => entry.session.id === sessionId);
  return session.tabs as { id: string; customerName: string; status: string }[];
};

/** O cliente escaneia o QR, digita o código e abre a comanda. */
export const joinAndOpenTab = async (
  page: Page,
  restaurant: TestRestaurant,
  label: string,
  joinCode: string,
  name: string,
  people = 1,
) => {
  await page.goto(restaurant.screen(`mesa/${restaurant.table(label)}`));
  await page.getByLabel("Código da mesa").fill(joinCode);
  await page.getByRole("button", { name: "Entrar na mesa" }).click();
  await page.getByLabel("Como podemos te chamar?").fill(name);
  for (let count = 1; count < people; count += 1) {
    await page.getByRole("button", { name: "Uma pessoa a mais" }).click();
  }
  await page.getByRole("button", { name: "Abrir comanda" }).click();
  await expect(page.getByRole("searchbox", { name: "Buscar no cardápio" })).toBeVisible();
};

/** Cria uma conta e um restaurante pela tela e entra na tela do gerente dele pela conta. */
export const openOwnRestaurant = async (page: Page) => {
  const id = uniqueId();
  const slug = `teste-${id}`;
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Seu nome").fill("Dona");
  const email = `dona-${id}@exemplo.com`;
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha-forte-1");
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await page.getByLabel("Nome do restaurante").fill("Casa Teste");
  await page.getByLabel("Endereço").fill(slug);
  await page.getByRole("button", { name: "Criar restaurante" }).click();
  await page.getByRole("button", { name: "Já anotei" }).click();
  await page.getByRole("button", { name: "Abrir a tela do gerente de Casa Teste" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Gerente · Dona" })).toBeVisible();
  return { slug, email, password: "senha-forte-1" };
};
