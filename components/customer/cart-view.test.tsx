import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CartView } from "@/components/customer/cart-view";
import { MENU_CATEGORIES, MENU_ITEMS } from "@/lib/seed-data";

const menu = { categories: MENU_CATEGORIES, items: MENU_ITEMS };

const props = {
  menu,
  dispatch: vi.fn(),
  tabName: "Ana",
  needsApproval: false,
  sending: false,
  message: "",
  onSend: vi.fn(),
  onBack: vi.fn(),
};

describe("CartView", () => {
  it("mostra o total e envia", async () => {
    const onSend = vi.fn();
    render(<CartView {...props} onSend={onSend} cart={[{ menuItemId: "chope", quantity: 2, note: "" }]} />);
    expect(screen.getByText("Total dos itens").nextSibling?.textContent?.replace(/\s/g, " ")).toBe("R$ 26,00");
    await userEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("manda a observação digitada", async () => {
    const dispatch = vi.fn();
    render(<CartView {...props} dispatch={dispatch} cart={[{ menuItemId: "lasanha", quantity: 1, note: "" }]} />);
    await userEvent.type(screen.getByLabelText("Observação (opcional)"), "x");
    expect(dispatch).toHaveBeenCalledWith({ type: "note", menuItemId: "lasanha", note: "x" });
  });

  it("não deixa enviar com item esgotado", () => {
    const soldOut = { ...menu, items: menu.items.map((item) => ({ ...item, available: item.id !== "chope" })) };
    render(<CartView {...props} menu={soldOut} cart={[{ menuItemId: "chope", quantity: 1, note: "" }]} />);
    expect(screen.getByText("Esgotou. Tire do pedido.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar pedido" })).toBeDisabled();
  });

  it("explica a confirmação do primeiro pedido", () => {
    render(<CartView {...props} needsApproval cart={[{ menuItemId: "chope", quantity: 1, note: "" }]} />);
    expect(screen.getByText(/o garçom confirma/)).toBeInTheDocument();
  });

  it("leva ao cardápio quando está vazio", async () => {
    const onBack = vi.fn();
    render(<CartView {...props} onBack={onBack} cart={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver o cardápio" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
