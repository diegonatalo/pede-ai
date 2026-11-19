import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinTable } from "@/components/customer/join-table";
import { TABLES } from "@/lib/seed-data";

const table = TABLES[2];

/** Responde por URL e método; guarda as chamadas para conferir o corpo. */
const mockApi = (routes: Record<string, () => Response>) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    const route = routes[key];
    if (!route) throw new Error(`rota não simulada: ${key}`);
    return route();
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("JoinTable", () => {
  it("entra com o código da mesa", async () => {
    const spy = mockApi({
      "GET /api/tables/mesa-3": () => Response.json({ table, open: true }),
      "POST /api/tables/mesa-3/join": () => Response.json({ sessionId: "s1" }),
    });
    const onJoined = vi.fn();
    render(<JoinTable tableId="mesa-3" onJoined={onJoined} />);

    const input = await screen.findByLabelText("Código da mesa");
    const submit = screen.getByRole("button", { name: "Entrar na mesa" });
    expect(submit).toBeDisabled();
    // Só aceita números, até quatro.
    await userEvent.type(input, "12a345");
    expect(input).toHaveValue("1234");
    await userEvent.click(submit);

    expect(onJoined).toHaveBeenCalledOnce();
    const [, init] = spy.mock.calls.at(-1) ?? [];
    expect(init?.body).toBe(JSON.stringify({ code: "1234" }));
  });

  it("mostra a mensagem do servidor quando o código está errado", async () => {
    mockApi({
      "GET /api/tables/mesa-3": () => Response.json({ table, open: true }),
      "POST /api/tables/mesa-3/join": () =>
        Response.json({ error: "wrong_code", message: "Código errado. Confira com o garçom." }, { status: 401 }),
    });
    const onJoined = vi.fn();
    render(<JoinTable tableId="mesa-3" onJoined={onJoined} />);
    await userEvent.type(await screen.findByLabelText("Código da mesa"), "0000");
    await userEvent.click(screen.getByRole("button", { name: "Entrar na mesa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Código errado");
    expect(onJoined).not.toHaveBeenCalled();
  });

  it("avisa quando a mesa ainda não foi aberta", async () => {
    mockApi({ "GET /api/tables/mesa-3": () => Response.json({ table, open: false }) });
    render(<JoinTable tableId="mesa-3" onJoined={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "A mesa ainda não foi aberta" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Código da mesa")).not.toBeInTheDocument();
  });

  it("avisa quando o QR não é de uma mesa", async () => {
    mockApi({ "GET /api/tables/mesa-99": () => Response.json({ table: null, open: false }) });
    render(<JoinTable tableId="mesa-99" onJoined={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Mesa não encontrada" })).toBeInTheDocument();
  });
});
