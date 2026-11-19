import { describe, expect, it } from "vitest";
import {
  cartCount,
  cartQuantity,
  cartReducer,
  cartToLines,
  cartTotal,
  unavailableInCart,
  type Cart,
} from "@/lib/cart";

const apply = (...actions: Parameters<typeof cartReducer>[1][]) =>
  actions.reduce<Cart>((cart, action) => cartReducer(cart, action), []);

describe("cartReducer", () => {
  it("soma quantidade ao adicionar o mesmo item", () => {
    const cart = apply({ type: "add", menuItemId: "chope" }, { type: "add", menuItemId: "chope" });
    expect(cart).toEqual([{ menuItemId: "chope", quantity: 2, note: "" }]);
  });

  it("tira o item quando a quantidade chega a zero", () => {
    const cart = apply(
      { type: "add", menuItemId: "chope" },
      { type: "add", menuItemId: "agua" },
      { type: "decrement", menuItemId: "chope" },
    );
    expect(cart.map((line) => line.menuItemId)).toEqual(["agua"]);
  });

  it("não passa de 20 unidades por item", () => {
    const actions = Array.from({ length: 25 }, () => ({ type: "add" as const, menuItemId: "chope" }));
    expect(cartQuantity(apply(...actions), "chope")).toBe(20);
  });

  it("guarda a observação, cortada no limite, e remove ou limpa", () => {
    let cart = apply({ type: "add", menuItemId: "lasanha" }, { type: "note", menuItemId: "lasanha", note: "a".repeat(200) });
    expect(cart[0].note).toHaveLength(140);
    cart = cartReducer(cart, { type: "remove", menuItemId: "lasanha" });
    expect(cart).toEqual([]);
    expect(cartReducer(apply({ type: "add", menuItemId: "x" }), { type: "clear" })).toEqual([]);
  });
});

describe("contas do carrinho", () => {
  const menu = [
    { id: "chope", priceCents: 1300, available: true },
    { id: "burrata", priceCents: 5800, available: false },
  ];

  it("conta itens e soma o total", () => {
    const cart = apply(
      { type: "add", menuItemId: "chope" },
      { type: "add", menuItemId: "chope" },
      { type: "add", menuItemId: "burrata" },
    );
    expect(cartCount(cart)).toBe(3);
    expect(cartTotal(cart, menu)).toBe(2600 + 5800);
    expect(cartQuantity(cart, "agua")).toBe(0);
  });

  it("monta as linhas sem observação vazia", () => {
    const cart = apply(
      { type: "add", menuItemId: "chope" },
      { type: "add", menuItemId: "burrata" },
      { type: "note", menuItemId: "burrata", note: "  sem pesto " },
    );
    expect(cartToLines(cart)).toEqual([
      { menuItemId: "chope", quantity: 1 },
      { menuItemId: "burrata", quantity: 1, note: "sem pesto" },
    ]);
  });

  it("aponta os itens que esgotaram ou sumiram do cardápio", () => {
    const cart = apply(
      { type: "add", menuItemId: "chope" },
      { type: "add", menuItemId: "burrata" },
      { type: "add", menuItemId: "fantasma" },
    );
    expect(unavailableInCart(cart, menu)).toEqual(["burrata", "fantasma"]);
  });
});
