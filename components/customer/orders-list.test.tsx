import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OrdersList } from "@/components/customer/orders-list";
import { RESTAURANT, TABLES } from "@/lib/seed-data";
import type { CustomerView } from "@/lib/views";
import type { ItemStatus, OrderItem } from "@/types/domain";

const item = (id: string, nameSnapshot: string, status: ItemStatus): OrderItem => ({
  id,
  orderId: "o1",
  menuItemId: id,
  nameSnapshot,
  unitPriceCents: 1000,
  quantity: 1,
  station: "kitchen",
  status,
  shares: [{ tabId: "t1", parts: 1 }],
  updatedAt: "2026-11-18T20:00:00.000Z",
});

const view = (items: OrderItem[]): CustomerView => ({
  session: { id: "s1", status: "open", tableId: "mesa-3" },
  table: TABLES[2],
  restaurant: RESTAURANT,
  tabs: [{ id: "t1", customerName: "Ana", peopleCount: 1, status: "open", approved: false, mine: true }],
  orders: [{ id: "o1", sessionId: "s1", tabId: "t1", createdAt: "2026-11-18T20:00:00.000Z" }],
  items,
  calls: [],
});

describe("OrdersList", () => {
  it("mostra o estado de cada item e cancela só o que ainda não foi para o preparo", async () => {
    const onCancel = vi.fn();
    render(
      <OrdersList
        view={view([item("a", "Chope", "awaiting_approval"), item("b", "Risoto", "preparing")])}
        onCancel={onCancel}
        busyItemId={null}
        onBrowse={vi.fn()}
      />,
    );
    expect(screen.getByText("Aguardando o garçom")).toBeInTheDocument();
    expect(screen.getByText("Em preparo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar Risoto" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar Chope" }));
    expect(onCancel).toHaveBeenCalledWith("a");
    expect(screen.getByRole("status")).toHaveTextContent("O garçom vai confirmar");
  });

  it("convida a ver o cardápio quando não há pedidos", async () => {
    const onBrowse = vi.fn();
    render(<OrdersList view={{ ...view([]), orders: [] }} onCancel={vi.fn()} busyItemId={null} onBrowse={onBrowse} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver o cardápio" }));
    expect(onBrowse).toHaveBeenCalledOnce();
  });
});
