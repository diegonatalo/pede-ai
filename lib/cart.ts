import { LIMITS } from "@/lib/store/input";
import type { Cents, MenuItem } from "@/types/domain";
import type { OrderLineInput } from "@/types/store";

/** Carrinho do cliente antes de enviar o pedido. Uma linha por item do cardápio. */
export type CartLine = { menuItemId: string; quantity: number; note: string };

export type Cart = CartLine[];

export type CartAction =
  | { type: "add"; menuItemId: string }
  | { type: "decrement"; menuItemId: string }
  | { type: "remove"; menuItemId: string }
  | { type: "note"; menuItemId: string; note: string }
  | { type: "clear" };

export const cartReducer = (cart: Cart, action: CartAction): Cart => {
  switch (action.type) {
    case "add": {
      const line = cart.find((entry) => entry.menuItemId === action.menuItemId);
      if (!line) {
        if (cart.length >= LIMITS.linesPerOrder) return cart;
        return [...cart, { menuItemId: action.menuItemId, quantity: 1, note: "" }];
      }
      return cart.map((entry) =>
        entry === line ? { ...entry, quantity: Math.min(entry.quantity + 1, LIMITS.quantity) } : entry,
      );
    }
    case "decrement":
      return cart.flatMap((entry) => {
        if (entry.menuItemId !== action.menuItemId) return [entry];
        return entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : [];
      });
    case "remove":
      return cart.filter((entry) => entry.menuItemId !== action.menuItemId);
    case "note":
      return cart.map((entry) =>
        entry.menuItemId === action.menuItemId
          ? { ...entry, note: action.note.slice(0, LIMITS.note) }
          : entry,
      );
    case "clear":
      return [];
  }
};

export const cartQuantity = (cart: Cart, menuItemId: string) =>
  cart.find((entry) => entry.menuItemId === menuItemId)?.quantity ?? 0;

export const cartCount = (cart: Cart) => cart.reduce((sum, entry) => sum + entry.quantity, 0);

export const cartTotal = (cart: Cart, menu: Pick<MenuItem, "id" | "priceCents">[]): Cents => {
  const prices = new Map(menu.map((item) => [item.id, item.priceCents]));
  return cart.reduce((sum, entry) => sum + (prices.get(entry.menuItemId) ?? 0) * entry.quantity, 0);
};

/** Linhas para a API; observação vazia não vai. */
export const cartToLines = (cart: Cart): OrderLineInput[] =>
  cart.map(({ menuItemId, quantity, note }) => ({
    menuItemId,
    quantity,
    ...(note.trim() && { note: note.trim() }),
  }));

/** Itens do carrinho que esgotaram enquanto a pessoa escolhia. */
export const unavailableInCart = (cart: Cart, menu: Pick<MenuItem, "id" | "available">[]) => {
  const available = new Map(menu.map((item) => [item.id, item.available]));
  return cart.filter((entry) => available.get(entry.menuItemId) !== true).map((entry) => entry.menuItemId);
};
