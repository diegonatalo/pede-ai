import { collectErrors, expect, test, title } from "./fixtures";

const HOME = "O pedido sai da mesa e chega na cozinha. A conta sai certa para cada um.";

for (const { path, heading } of [
  { path: "/", heading: HOME },
  { path: "/entrar", heading: "Entrar na sua conta" },
  { path: "/privacidade", heading: "Privacidade" },
  { path: "/termos", heading: "Termos de uso" },
]) {
  test(`abre ${path} sem erros no console`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(path);
    await expect(title(page, heading)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("as telas de um restaurante abrem sem erros no console", async ({ page, restaurant }) => {
  const errors = collectErrors(page);
  for (const { path, heading } of [
    { path: restaurant.screen(`mesa/${restaurant.table("Mesa 1")}`), heading: "A mesa ainda não foi aberta" },
    { path: restaurant.screen("mesa/nao-existe"), heading: "Mesa não encontrada" },
    { path: restaurant.screen("garcom"), heading: "Garçom" },
    { path: restaurant.screen("cozinha"), heading: "Cozinha e bar" },
    { path: restaurant.screen("gerente"), heading: "Gerente" },
  ]) {
    await page.goto(path);
    await expect(title(page, heading)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("endereço desconhecido mostra a 404 e volta ao início", async ({ page }) => {
  const response = await page.goto("/nao-existe");
  expect(response?.status()).toBe(404);
  await expect(title(page, "Página não encontrada")).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page).toHaveURL("/");
  await expect(title(page, HOME)).toBeVisible();
});

test("os endereços da antiga demonstração não existem mais", async ({ request }) => {
  for (const path of ["/demo", "/garcom", "/cozinha", "/gerente", "/mesa/mesa-1"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test("a página inicial leva à política de privacidade", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacidade" }).click();
  await expect(page).toHaveURL("/privacidade");
  await expect(page.getByText("30 dias depois que a mesa fecha")).toBeVisible();
});

test("a página inicial leva aos termos de uso, que levam à privacidade", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Termos de uso" }).click();
  await expect(page).toHaveURL("/termos");
  await expect(page.getByRole("heading", { name: "Quem responde pelo quê" })).toBeVisible();
  await page.getByRole("link", { name: "política de privacidade" }).click();
  await expect(page).toHaveURL("/privacidade");
});

test("a limpeza de dados pessoais só roda com a senha do agendador", async ({ request }) => {
  expect((await request.get("/api/cron/privacy")).status()).toBe(401);
  const wrong = await request.get("/api/cron/privacy", { headers: { authorization: "Bearer errada" } });
  expect(wrong.status()).toBe(401);
});
