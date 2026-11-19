import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CallWaiter } from "@/components/customer/call-waiter";
import { TABLES } from "@/lib/seed-data";
import type { CustomerView } from "@/lib/views";
import type { WaiterCall } from "@/types/domain";

const view = (calls: WaiterCall[]): CustomerView => ({
  session: { id: "s1", status: "open", tableId: "mesa-1" },
  table: TABLES[0],
  restaurant: { name: "Cantina", serviceFeePercent: 10, couvertCents: 0 },
  tabs: [{ id: "a", customerName: "Ana", peopleCount: 1, status: "open", approved: true, mine: true }],
  orders: [],
  items: [],
  calls,
});

const call = (status: WaiterCall["status"]): WaiterCall => ({
  id: "c1",
  sessionId: "s1",
  tabId: "a",
  reason: "question",
  message: "tem opção sem glúten?",
  status,
  createdAt: "2026-11-18T20:00:00.000Z",
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CallWaiter", () => {
  it("chama o garçom com o motivo e o recado", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    const refresh = vi.fn(async () => {});
    render(<CallWaiter view={view([])} tabId="a" refresh={refresh} />);
    await userEvent.click(screen.getByLabelText("Outro assunto"));
    await userEvent.type(screen.getByLabelText("Recado (opcional)"), "cadeira para bebê");
    await userEvent.click(screen.getByRole("button", { name: "Chamar o garçom" }));
    expect(spy.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ tabId: "a", reason: "other", message: "cadeira para bebê" }),
    );
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByLabelText("Recado (opcional)")).toHaveValue("");
  });

  it("mostra o chamado aberto e deixa desistir", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    render(<CallWaiter view={view([call("open")])} tabId="a" refresh={vi.fn(async () => {})} />);
    expect(screen.getByRole("status")).toHaveTextContent("Chamando");
    expect(screen.getByRole("status")).toHaveTextContent("tem opção sem glúten?");
    await userEvent.click(screen.getByRole("button", { name: "Não preciso mais" }));
    expect(spy.mock.calls[0][0]).toBe("/api/customer/calls/c1/status");
  });

  it("avisa que o garçom está a caminho, sem botão de desistir", () => {
    render(<CallWaiter view={view([call("acknowledged")])} tabId="a" refresh={vi.fn(async () => {})} />);
    expect(screen.getByRole("status")).toHaveTextContent("O garçom está a caminho");
    expect(screen.queryByRole("button", { name: "Não preciso mais" })).not.toBeInTheDocument();
  });
});
