import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NowPanel } from "@/components/waiter/now-panel";
import { TABLES } from "@/lib/seed-data";
import type { ItemStatus, OrderItem, Tab, WaiterCall } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

const AT = "2026-11-18T20:00:00.000Z";

const tab = (id: string, customerName: string, approved: boolean): Tab => ({
  id,
  sessionId: "s1",
  customerName,
  peopleCount: 1,
  status: "open",
  approved,
  createdAt: AT,
});

const item = (id: string, name: string, tabId: string, status: ItemStatus): OrderItem => ({
  id,
  orderId: `o-${tabId}`,
  menuItemId: id,
  nameSnapshot: name,
  unitPriceCents: 1000,
  quantity: 1,
  station: "kitchen",
  status,
  shares: [{ tabId, parts: 1 }],
  updatedAt: AT,
});

const calls: WaiterCall[] = [
  { id: "c1", sessionId: "s1", tabId: "bia", reason: "bill", status: "open", createdAt: AT },
];

const session: SessionSnapshot = {
  session: { id: "s1", restaurantId: "demo", tableId: "mesa-3", status: "open", openedAt: AT },
  table: TABLES[2],
  tabs: [tab("ana", "Ana", false), tab("bia", "Bia", true)],
  orders: [
    { id: "o-ana", sessionId: "s1", tabId: "ana", createdAt: AT },
    { id: "o-bia", sessionId: "s1", tabId: "bia", createdAt: AT },
  ],
  items: [
    item("i1", "Chope", "ana", "awaiting_approval"),
    item("i2", "Risoto de cogumelos", "bia", "ready"),
    item("i3", "Lasanha à bolonhesa", "bia", "picked_up"),
  ],
  calls,
};

describe("NowPanel", () => {
  it("confirma a comanda nova", async () => {
    const run = vi.fn();
    render(<NowPanel sessions={[session]} busy={null} run={run} />);
    expect(screen.getByRole("heading", { name: "Mesa 3 · Ana" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar comanda de Ana" }));
    expect(run).toHaveBeenCalledWith("ana", "/api/staff/tabs/ana/approve");
  });

  it("retira o item pronto e entrega o que está com o garçom", async () => {
    const run = vi.fn();
    render(<NowPanel sessions={[session]} busy={null} run={run} />);
    await userEvent.click(screen.getByRole("button", { name: "Retirei Risoto de cogumelos da Mesa 3" }));
    expect(run).toHaveBeenCalledWith("i2", "/api/staff/items/i2/status", { to: "picked_up" });
    await userEvent.click(screen.getByRole("button", { name: "Entreguei Lasanha à bolonhesa da Mesa 3" }));
    expect(run).toHaveBeenCalledWith("i3", "/api/staff/items/i3/status", { to: "delivered" });
  });

  it("atende o chamado de conta", async () => {
    const run = vi.fn();
    render(<NowPanel sessions={[session]} busy={null} run={run} />);
    expect(screen.getByText("Pedir a conta")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Estou indo: Mesa 3" }));
    expect(run).toHaveBeenCalledWith("c1", "/api/staff/calls/c1/status", { to: "acknowledged" });
  });

  it("desabilita o botão que está em andamento", () => {
    render(<NowPanel sessions={[session]} busy="ana" run={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Confirmar comanda de Ana" })).toBeDisabled();
  });

  it("diz quando não há nada a fazer", () => {
    render(<NowPanel sessions={[]} busy={null} run={vi.fn()} />);
    expect(screen.getAllByText("Nada por aqui.")).toHaveLength(3);
  });
});
