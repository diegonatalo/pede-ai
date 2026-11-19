import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MenuEditor } from "@/components/manager/menu-editor";
import type { Menu } from "@/types/store";

const MENU: Menu = {
  categories: [
    { id: "c2", restaurantId: "r", name: "Bebidas", position: 1 },
    { id: "c1", restaurantId: "r", name: "Entradas", position: 0 },
    { id: "c3", restaurantId: "r", name: "Vazia", position: 2 },
  ],
  items: [
    { id: "i1", restaurantId: "r", categoryId: "c1", name: "Pão de alho", description: "Na brasa", priceCents: 1800, station: "kitchen", available: true },
    { id: "i2", restaurantId: "r", categoryId: "c1", name: "Bolinho", description: "", priceCents: 2400, station: "kitchen", available: false },
    { id: "i3", restaurantId: "r", categoryId: "c2", name: "Chope", description: "", priceCents: 1200, station: "bar", available: true },
  ],
};

const setup = (ok = true) => {
  const run = vi.fn(async () => ok);
  render(<MenuEditor menu={MENU} busy={null} run={run} />);
  return { run };
};

const bodyOf = (run: ReturnType<typeof setup>["run"], call = 0) => {
  const args = run.mock.calls[call] as unknown[];
  expect(args[1]).toBe("/api/staff/menu");
  return args[2];
};

describe("MenuEditor", () => {
  it("mostra as categorias na ordem, com preço, preparo e esgotado", () => {
    setup();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Entradas",
      "Bebidas",
      "Vazia",
    ]);
    const entradas = screen.getByRole("list", { name: "Itens de Entradas" });
    expect(within(entradas).getByText(/R\$\s18,00 · Cozinha/)).toBeInTheDocument();
    expect(within(entradas).getByText("Na brasa")).toBeInTheDocument();
    expect(within(entradas).getByText("esgotado")).toBeInTheDocument();
    expect(screen.getByText("Nenhum item nesta categoria.")).toBeInTheDocument();
  });

  it("ordena, sem subir o primeiro nem descer o último", async () => {
    const { run } = setup();
    expect(screen.getByRole("button", { name: "Subir a categoria Entradas" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer a categoria Vazia" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Subir Pão de alho" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Descer Pão de alho" }));
    expect(bodyOf(run)).toEqual({ type: "move_item", id: "i1", direction: "down" });
    await userEvent.click(screen.getByRole("button", { name: "Subir a categoria Bebidas" }));
    expect(bodyOf(run, 1)).toEqual({ type: "move_category", id: "c2", direction: "up" });
  });

  it("cria um item lendo o preço em reais", async () => {
    const { run } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Novo item em Bebidas" }));
    const form = screen.getByRole("form", { name: "Novo item" });
    await userEvent.type(within(form).getByLabelText("Nome"), "Suco de caju");
    await userEvent.type(within(form).getByLabelText("Preço (R$)"), "9,90");
    await userEvent.selectOptions(within(form).getByLabelText("Preparo"), "bar");
    await userEvent.click(within(form).getByRole("button", { name: "Adicionar item" }));
    expect(bodyOf(run)).toEqual({
      type: "save_item",
      categoryId: "c2",
      name: "Suco de caju",
      description: "",
      priceCents: 990,
      station: "bar",
    });
    // Deu certo: o formulário fecha.
    expect(screen.queryByRole("form", { name: "Novo item" })).not.toBeInTheDocument();
  });

  it("recusa preço inválido sem chamar o servidor", async () => {
    const { run } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Novo item em Bebidas" }));
    const form = screen.getByRole("form", { name: "Novo item" });
    await userEvent.type(within(form).getByLabelText("Nome"), "Suco");
    await userEvent.type(within(form).getByLabelText("Preço (R$)"), "nove");
    await userEvent.click(within(form).getByRole("button", { name: "Adicionar item" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Digite o preço em reais");
    expect(run).not.toHaveBeenCalled();
  });

  it("edita um item com os valores atuais e mantém o formulário aberto se o servidor recusar", async () => {
    const { run } = setup(false);
    await userEvent.click(screen.getByRole("button", { name: "Editar Bolinho" }));
    const form = screen.getByRole("form", { name: "Editar Bolinho" });
    expect(within(form).getByLabelText("Preço (R$)")).toHaveValue("24,00");
    await userEvent.selectOptions(within(form).getByLabelText("Categoria"), "c2");
    await userEvent.click(within(form).getByRole("button", { name: "Salvar item" }));
    expect(bodyOf(run)).toMatchObject({ type: "save_item", id: "i2", categoryId: "c2", priceCents: 2400 });
    expect(screen.getByRole("form", { name: "Editar Bolinho" })).toBeInTheDocument();
  });

  it("exclui em dois passos e só oferece excluir categoria vazia", async () => {
    const { run } = setup();
    expect(screen.queryByRole("button", { name: "Excluir a categoria Entradas" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Excluir Chope" }));
    expect(run).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar exclusão de Chope" }));
    expect(bodyOf(run)).toEqual({ type: "delete_item", id: "i3" });

    await userEvent.click(screen.getByRole("button", { name: "Excluir a categoria Vazia" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar exclusão de a categoria Vazia" }));
    expect(bodyOf(run, 1)).toEqual({ type: "delete_category", id: "c3" });
  });

  it("renomeia e cria categorias", async () => {
    const { run } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Renomear a categoria Bebidas" }));
    const rename = screen.getByRole("form", { name: "Renomear Bebidas" });
    await userEvent.clear(within(rename).getByLabelText("Nome da categoria"));
    await userEvent.type(within(rename).getByLabelText("Nome da categoria"), "Bebidas e sucos");
    await userEvent.click(within(rename).getByRole("button", { name: "Salvar" }));
    expect(bodyOf(run)).toEqual({ type: "save_category", id: "c2", name: "Bebidas e sucos" });

    const create = screen.getByRole("form", { name: "Nova categoria" });
    await userEvent.type(within(create).getByLabelText("Nova categoria"), "Petiscos");
    await userEvent.click(within(create).getByRole("button", { name: "Criar categoria" }));
    expect(bodyOf(run, 1)).toEqual({ type: "save_category", name: "Petiscos" });
    expect(within(create).getByLabelText("Nova categoria")).toHaveValue("");
  });
});
