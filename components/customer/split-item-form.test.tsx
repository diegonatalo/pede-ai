import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SplitItemForm } from "@/components/customer/split-item-form";
import type { CustomerTab } from "@/lib/views";
import type { OrderItem } from "@/types/domain";

const tab = (id: string, customerName: string, mine: boolean, status: CustomerTab["status"] = "open"): CustomerTab => ({
  id,
  customerName,
  peopleCount: 2,
  status,
  approved: true,
  mine,
});

const tabs = [tab("a", "Ana e Rui", true), tab("b", "Bia e Leo", false), tab("z", "Zé", false, "paid")];

const wine: OrderItem = {
  id: "vinho",
  orderId: "o1",
  menuItemId: "vinho-garrafa",
  nameSnapshot: "Vinho tinto (garrafa)",
  unitPriceCents: 12900,
  quantity: 1,
  station: "bar",
  status: "delivered",
  shares: [{ tabId: "a", parts: 1 }],
  updatedAt: "2026-11-18T20:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SplitItemForm", () => {
  it("divide igualmente entre as comandas marcadas e mostra o valor de cada uma", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    const onDone = vi.fn();
    render(<SplitItemForm item={wine} tabs={tabs} onDone={onDone} />);

    // Comanda paga não aparece.
    expect(screen.queryByLabelText("Zé")).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Bia e Leo"));
    expect(screen.getAllByText(/R\$\s64,50/)).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Salvar divisão" }));
    expect(onDone).toHaveBeenCalledWith(true);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("/api/customer/items/vinho/shares");
    expect(init?.body).toBe(JSON.stringify({ shares: [{ tabId: "a", parts: 1 }, { tabId: "b", parts: 1 }] }));
  });

  it("aceita partes diferentes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    render(<SplitItemForm item={wine} tabs={tabs} onDone={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("Bia e Leo"));
    await userEvent.click(screen.getByRole("button", { name: "Uma parte a mais para Ana e Rui" }));
    // 12900 em 2:1 → 8600 e 4300.
    expect(screen.getByText(/R\$\s86,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s43,00/)).toBeInTheDocument();
  });

  it("não salva sem nenhuma comanda e cancela", async () => {
    const onDone = vi.fn();
    render(<SplitItemForm item={wine} tabs={tabs} onDone={onDone} />);
    await userEvent.click(screen.getByLabelText("Ana e Rui (você)"));
    expect(screen.getByRole("button", { name: "Salvar divisão" })).toBeDisabled();
    expect(screen.getByText("Marque pelo menos uma comanda.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onDone).toHaveBeenCalledWith(false);
  });
});
