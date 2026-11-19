import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useReducer } from "react";
import { describe, expect, it } from "vitest";
import { MenuList } from "@/components/customer/menu-list";
import { cartReducer } from "@/lib/cart";
import { MENU_CATEGORIES, MENU_ITEMS } from "@/lib/seed-data";

const menu = {
  categories: MENU_CATEGORIES,
  items: MENU_ITEMS.map((item) => (item.id === "tiramisu" ? { ...item, available: false } : item)),
};

const Harness = () => {
  const [cart, dispatch] = useReducer(cartReducer, []);
  return (
    <>
      <MenuList menu={menu} cart={cart} dispatch={dispatch} />
      <output data-testid="carrinho">{JSON.stringify(cart.map((line) => [line.menuItemId, line.quantity]))}</output>
    </>
  );
};

describe("MenuList", () => {
  it("adiciona, aumenta e tira itens do carrinho", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar Chope" }));
    await userEvent.click(screen.getByRole("button", { name: "Mais um Chope" }));
    expect(screen.getByTestId("carrinho")).toHaveTextContent('[["chope",2]]');
    await userEvent.click(screen.getByRole("button", { name: "Tirar um Chope" }));
    await userEvent.click(screen.getByRole("button", { name: "Tirar um Chope" }));
    expect(screen.getByTestId("carrinho")).toHaveTextContent("[]");
    expect(screen.getByRole("button", { name: "Adicionar Chope" })).toBeInTheDocument();
  });

  it("mostra esgotado sem botão de adicionar", () => {
    render(<Harness />);
    const card = screen.getByRole("heading", { name: "Tiramisù" }).closest("li");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("Esgotado")).toBeInTheDocument();
    expect(within(card as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
  });

  it("busca sem acento e esconde categorias vazias", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar no cardápio" }), "cafe");
    expect(screen.getByRole("heading", { name: "Café espresso" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Entradas" })).not.toBeInTheDocument();
  });

  it("avisa quando a busca não acha nada", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar no cardápio" }), "pizza");
    expect(screen.getByText(/Nada encontrado/)).toBeInTheDocument();
  });
});
