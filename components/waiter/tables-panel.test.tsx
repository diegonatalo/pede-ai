import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TablesPanel } from "@/components/waiter/tables-panel";
import { RESTAURANT, TABLES } from "@/lib/seed-data";
import { tableBoard } from "@/lib/selectors";
import type { Tab } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

const AT = "2026-11-18T20:00:00.000Z";

const snapshot = (tabs: Tab[]): SessionSnapshot => ({
  session: { id: "s1", restaurantId: "demo", tableId: "mesa-1", status: "open", openedAt: AT },
  table: TABLES[0],
  tabs,
  orders: [{ id: "o1", sessionId: "s1", tabId: "ana", createdAt: AT }],
  items: [
    {
      id: "i1",
      orderId: "o1",
      menuItemId: "chope",
      nameSnapshot: "Chope",
      unitPriceCents: 1300,
      quantity: 2,
      station: "bar",
      status: "delivered",
      shares: [{ tabId: "ana", parts: 1 }],
      updatedAt: AT,
      timeline: {},
    },
  ],
  calls: [],
});

const ana = (status: Tab["status"]): Tab => ({
  id: "ana",
  sessionId: "s1",
  customerName: "Ana",
  peopleCount: 1,
  status,
  approved: true,
  createdAt: AT,
});

const board = (tabs: Tab[]) => tableBoard(TABLES.slice(0, 2), [snapshot(tabs)], RESTAURANT, { s1: "4821" });

describe("TablesPanel", () => {
  it("abre uma mesa livre", async () => {
    const run = vi.fn();
    render(<TablesPanel board={board([ana("open")])} busy={null} run={run} />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir a Mesa 2" }));
    expect(run).toHaveBeenCalledWith("mesa-2", "/api/staff/sessions", { tableId: "mesa-2" });
  });

  it("mostra o código, a comanda com o total e recebe", async () => {
    const run = vi.fn();
    render(<TablesPanel board={board([ana("bill_requested")])} busy={null} run={run} />);
    expect(screen.getByText("4821")).toBeInTheDocument();
    expect(screen.getByText(/pediram a conta/)).toBeInTheDocument();
    // 2 × 13,00 + 10% = 28,60
    expect(screen.getByText(/Conta pedida · R\$\s28,60/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fechar a Mesa 1" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Marcar a comanda de Ana (Mesa 1) como paga" }));
    expect(run).toHaveBeenCalledWith("ana", "/api/staff/tabs/ana/status", { to: "paid" });
  });

  it("fecha a mesa quando está tudo pago", async () => {
    const run = vi.fn();
    render(<TablesPanel board={board([ana("paid")])} busy={null} run={run} />);
    expect(screen.queryByRole("button", { name: /como paga/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fechar a Mesa 1" }));
    expect(run).toHaveBeenCalledWith("s1", "/api/staff/sessions/s1/close");
  });
});
