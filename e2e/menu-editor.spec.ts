import { expect, test } from "@playwright/test";
import { collectErrors, openOwnRestaurant } from "./fixtures";

type PublicMenu = {
  categories: { id: string; name: string; position: number }[];
  items: { name: string; priceCents: number; categoryId: string }[];
};

test("o gerente monta o cardápio e o cliente vê na hora", async ({ page }) => {
  // Restaurante próprio: os outros testes usam o cardápio da demo em paralelo.
  const slug = await openOwnRestaurant(page);
  const errors = collectErrors(page);
  const publicMenu = async (): Promise<PublicMenu> => (await page.request.get(`/api/menu?r=${slug}`)).json();

  await page.getByRole("button", { name: "Cardápio" }).click();
  await page.getByRole("form", { name: "Nova categoria" }).getByLabel("Nova categoria").fill("Petiscos");
  await page.getByRole("button", { name: "Criar categoria" }).click();
  const petiscos = page.getByRole("region", { name: "Petiscos" });
  await expect(petiscos).toBeVisible();

  await petiscos.getByRole("button", { name: "Novo item em Petiscos" }).click();
  const form = petiscos.getByRole("form", { name: "Novo item" });
  await form.getByLabel("Nome").fill("Batata frita");
  await form.getByLabel("Descrição").fill("Porção com alecrim");
  await form.getByLabel("Preço (R$)").fill("28");
  await form.getByRole("button", { name: "Adicionar item" }).click();
  await expect(petiscos.getByText(/R\$\s28,00 · Cozinha/)).toBeVisible();
  await expect(petiscos.getByText("Porção com alecrim")).toBeVisible();

  // Sobe a categoria nova para o topo.
  for (let step = 0; step < 5; step++) {
    await page.getByRole("button", { name: "Subir a categoria Petiscos" }).click();
  }
  await expect(page.getByRole("button", { name: "Subir a categoria Petiscos" })).toBeDisabled();

  await petiscos.getByRole("button", { name: "Editar Batata frita" }).click();
  await petiscos.getByLabel("Preço (R$)").fill("31,50");
  await petiscos.getByRole("button", { name: "Salvar item" }).click();
  await expect(petiscos.getByText(/R\$\s31,50/)).toBeVisible();

  // O cardápio do cliente (a mesma API da tela da mesa) já mudou.
  const menu = await publicMenu();
  const first = [...menu.categories].sort((a, b) => a.position - b.position)[0];
  expect(first.name).toBe("Petiscos");
  expect(menu.items.find((item) => item.name === "Batata frita")).toMatchObject({ priceCents: 3150, categoryId: first.id });

  // Excluir pede confirmação; categoria com itens não oferece excluir.
  await expect(petiscos.getByRole("button", { name: "Excluir a categoria Petiscos" })).toHaveCount(0);
  await petiscos.getByRole("button", { name: "Excluir Batata frita" }).click();
  await petiscos.getByRole("button", { name: "Confirmar exclusão de Batata frita" }).click();
  await expect(petiscos.getByText("Nenhum item nesta categoria.")).toBeVisible();
  await petiscos.getByRole("button", { name: "Excluir a categoria Petiscos" }).click();
  await petiscos.getByRole("button", { name: "Confirmar exclusão de a categoria Petiscos" }).click();
  await expect(page.getByRole("region", { name: "Petiscos" })).toHaveCount(0);
  expect((await publicMenu()).categories.some((category) => category.name === "Petiscos")).toBe(false);

  expect(errors).toEqual([]);
});

test("só o gerente edita o cardápio", async ({ request }) => {
  const response = await request.post("/api/staff/menu?role=waiter", {
    data: { type: "delete_item", id: "chope" },
    headers: { "content-type": "application/json" },
  });
  expect(response.status()).toBe(401);
});
