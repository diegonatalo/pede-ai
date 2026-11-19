import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueueBoard } from "@/components/kitchen/queue-board";
import { TABLES } from "@/lib/seed-data";
import type { KitchenQueue } from "@/lib/selectors";
import type { ItemStatus, OrderItem } from "@/types/domain";

const ticket = (id: string, name: string, status: ItemStatus, note?: string) => ({
  table: TABLES[2],
  tabName: "Ana",
  item: {
    id,
    orderId: "o1",
    menuItemId: id,
    nameSnapshot: name,
    unitPriceCents: 1000,
    quantity: 2,
    note,
    station: "bar",
    status,
    shares: [{ tabId: "ana", parts: 1 }],
    updatedAt: "2026-11-18T20:00:00.000Z",
  } satisfies OrderItem,
});

const queue: KitchenQueue = {
  sent: [ticket("i1", "Caipirinha", "sent", "pouco açúcar")],
  preparing: [ticket("i2", "Aperol spritz", "preparing")],
  ready: [ticket("i3", "Chope", "ready")],
};

describe("QueueBoard", () => {
  it("mostra as três colunas com quantidade, mesa e observação", () => {
    render(<QueueBoard queue={queue} showStation busy={null} run={vi.fn()} />);
    const novos = screen.getByRole("region", { name: /Novos/ });
    expect(within(novos).getByRole("heading", { name: "2× Caipirinha" })).toBeInTheDocument();
    expect(within(novos).getByText("pouco açúcar")).toBeInTheDocument();
    expect(within(novos).getByText(/Mesa 3 · Ana/)).toHaveTextContent("Bar");
  });

  it("avança e desfaz cada etapa", async () => {
    const run = vi.fn();
    render(<QueueBoard queue={queue} showStation={false} busy={null} run={run} />);
    await userEvent.click(screen.getByRole("button", { name: "Começar Caipirinha da Mesa 3" }));
    expect(run).toHaveBeenLastCalledWith("i1", "/api/staff/items/i1/status", { to: "preparing" });
    await userEvent.click(screen.getByRole("button", { name: "Aperol spritz da Mesa 3 está pronto" }));
    expect(run).toHaveBeenLastCalledWith("i2", "/api/staff/items/i2/status", { to: "ready" });
    await userEvent.click(screen.getByRole("button", { name: "Devolver Aperol spritz da Mesa 3 para a fila" }));
    expect(run).toHaveBeenLastCalledWith("i2", "/api/staff/items/i2/status", { to: "sent" });
    await userEvent.click(screen.getByRole("button", { name: "Chope da Mesa 3 ainda não está pronto" }));
    expect(run).toHaveBeenLastCalledWith("i3", "/api/staff/items/i3/status", { to: "preparing" });
  });

  it("avisa as colunas vazias", () => {
    render(<QueueBoard queue={{ sent: [], preparing: [], ready: [] }} showStation={false} busy={null} run={vi.fn()} />);
    expect(screen.getByText("Nenhum pedido novo.")).toBeInTheDocument();
    expect(screen.getByText("Nada no fogo.")).toBeInTheDocument();
    expect(screen.getByText("Nada esperando o garçom.")).toBeInTheDocument();
  });
});
