import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateTabForm } from "@/components/customer/create-tab-form";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CreateTabForm", () => {
  it("abre a comanda com o nome e o número de pessoas", async () => {
    const tab = { id: "t1", customerName: "Ana e Rui", peopleCount: 2 };
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(tab));
    const onCreated = vi.fn();
    render(<CreateTabForm mode="self" onCreated={onCreated} />);

    const submit = screen.getByRole("button", { name: "Abrir comanda" });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Como podemos te chamar?"), "Ana e Rui");
    expect(screen.getByRole("button", { name: "Uma pessoa a menos" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Uma pessoa a mais" }));
    await userEvent.click(submit);

    expect(onCreated).toHaveBeenCalledWith(tab);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("/api/customer/tabs");
    expect(init?.body).toBe(JSON.stringify({ customerName: "Ana e Rui", peopleCount: 2 }));
  });

  it("mostra o erro e deixa voltar no modo para outra pessoa", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "invalid_input", message: "Confira os dados e tente de novo." }, { status: 400 }),
    );
    const onCancel = vi.fn();
    render(<CreateTabForm mode="other" onCreated={vi.fn()} onCancel={onCancel} />);
    await userEvent.type(screen.getByLabelText("Nome da pessoa"), "Vó");
    await userEvent.click(screen.getByRole("button", { name: "Abrir comanda" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confira os dados");
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
