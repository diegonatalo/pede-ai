import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillView } from "@/components/customer/bill-view";
import { TABLES } from "@/lib/seed-data";
import type { CustomerTab, CustomerView } from "@/lib/views";
import type { ItemStatus, OrderItem } from "@/types/domain";

const AT = "2026-11-18T20:00:00.000Z";

const tab = (id: string, customerName: string, mine: boolean, status: CustomerTab["status"] = "open"): CustomerTab => ({
  id,
  customerName,
  peopleCount: 2,
  status,
  approved: true,
  mine,
});

const item = (id: string, name: string, orderId: string, price: number, shares: string[], status: ItemStatus = "delivered"): OrderItem => ({
  id,
  orderId,
  menuItemId: id,
  nameSnapshot: name,
  unitPriceCents: price,
  quantity: 1,
  station: "kitchen",
  status,
  shares: shares.map((tabId) => ({ tabId, parts: 1 })),
  updatedAt: AT,
  timeline: {},
});

const view = (status: CustomerTab["status"] = "open"): CustomerView => ({
  session: { id: "s1", status: "open", tableId: "mesa-6" },
  table: TABLES[5],
  restaurant: { name: "Cantina", serviceFeePercent: 10, couvertCents: 500 },
  tabs: [tab("a", "Ana e Rui", true, status), tab("b", "Bia e Leo", false)],
  orders: [{ id: "oa", sessionId: "s1", tabId: "a", createdAt: AT }],
  items: [
    item("massa", "Carbonara", "oa", 5900, ["a"]),
    item("burrata", "Burrata", "oa", 5800, ["a", "b"], "preparing"),
    // Pedido pela outra comanda e dividido com esta: aparece, mas sem "Dividir".
    item("vinho", "Vinho", "ob", 12900, ["b", "a"]),
  ],
  calls: [],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BillView", () => {
  it("soma itens, partes divididas, taxa e couvert por pessoa", () => {
    render(<BillView view={view()} refresh={vi.fn(async () => {})} />);
    const bill = screen.getByRole("article", { name: "Conta de Ana e Rui" });
    // 5900 + 5800/2 + 12900/2 = 15250; taxa 1525; couvert 2 × 500.
    expect(within(bill).getByText("Itens").nextSibling).toHaveTextContent(/152,50/);
    expect(within(bill).getByText("Taxa de serviço (10%)").nextSibling).toHaveTextContent(/15,25/);
    expect(within(bill).getByText("Couvert (2×)").nextSibling).toHaveTextContent(/10,00/);
    expect(within(bill).getByText("Total").nextSibling).toHaveTextContent(/177,75/);
    expect(within(bill).getByText(/1 item ainda não chegou/)).toBeInTheDocument();
    expect(within(bill).getAllByText("Dividido com Bia e Leo", { exact: false })).toHaveLength(2);
  });

  it("deixa dividir só o que a própria comanda pediu", () => {
    render(<BillView view={view()} refresh={vi.fn(async () => {})} />);
    expect(screen.getByRole("button", { name: "Dividir Carbonara" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dividir Vinho" })).not.toBeInTheDocument();
  });

  it("pede a conta e avisa o garçom por um chamado", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    const refresh = vi.fn(async () => {});
    render(<BillView view={view()} refresh={refresh} />);
    await userEvent.click(screen.getByRole("button", { name: "Pedir a conta de Ana e Rui" }));
    expect(spy.mock.calls.map(([url, init]) => [url, init?.body])).toEqual([
      ["/api/customer/tabs/a/status", JSON.stringify({ to: "bill_requested" })],
      ["/api/customer/calls", JSON.stringify({ tabId: "a", reason: "bill" })],
    ]);
    expect(refresh).toHaveBeenCalled();
  });

  it("mostra a conta pedida e deixa voltar a pedir", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    render(<BillView view={view("bill_requested")} refresh={vi.fn(async () => {})} />);
    expect(screen.getByRole("status")).toHaveTextContent("Conta pedida. O garçom já vem.");
    await userEvent.click(screen.getByRole("button", { name: "Quero pedir mais" }));
    expect(spy.mock.calls[0][1]?.body).toBe(JSON.stringify({ to: "open" }));
  });

  it("agradece quando a conta está paga e não deixa dividir", () => {
    render(<BillView view={view("paid")} refresh={vi.fn(async () => {})} />);
    expect(screen.getByText("Conta paga. Obrigado!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dividir/ })).not.toBeInTheDocument();
  });
});
