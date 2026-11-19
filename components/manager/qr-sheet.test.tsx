import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QrSheet } from "@/components/manager/qr-sheet";
import { TABLES } from "@/lib/seed-data";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QrSheet", () => {
  it("gera um QR por mesa com o link da tela do cliente", async () => {
    render(<QrSheet tables={TABLES.slice(0, 3)} />);
    const codes = await screen.findAllByRole("img", { name: /QR code da Mesa/ });
    expect(codes).toHaveLength(3);
    expect(codes[0].innerHTML.startsWith("<svg")).toBe(true);
    expect(screen.getByRole("heading", { name: "Mesa 2" })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/r/demo/mesa/mesa-1`)).toBeInTheDocument();
  });

  it("avisa quando os links apontam para o computador local", async () => {
    render(<QrSheet tables={TABLES.slice(0, 1)} />);
    await screen.findAllByRole("img", { name: /QR code/ });
    // O jsdom roda em http://localhost:3000.
    expect(screen.getByRole("alert")).toHaveTextContent("só funciona neste computador");
  });

  it("abre a impressão do navegador", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<QrSheet tables={TABLES.slice(0, 1)} />);
    await userEvent.click(await screen.findByRole("button", { name: "Imprimir" }));
    expect(print).toHaveBeenCalledOnce();
  });
});
