import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/components/manager/settings-form";
import { RESTAURANT } from "@/lib/seed-data";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsForm", () => {
  it("começa com a configuração atual e salva taxa, couvert e confirmação", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    const onSaved = vi.fn(async () => {});
    render(<SettingsForm restaurant={{ ...RESTAURANT, couvertCents: 1250 }} onSaved={onSaved} />);

    expect(screen.getByLabelText("Taxa de serviço (%)")).toHaveValue("10");
    expect(screen.getByLabelText("Couvert por pessoa (R$)")).toHaveValue("12,50");
    expect(screen.getByRole("checkbox")).toBeChecked();

    await userEvent.clear(screen.getByLabelText("Taxa de serviço (%)"));
    await userEvent.type(screen.getByLabelText("Taxa de serviço (%)"), "12");
    await userEvent.clear(screen.getByLabelText("Couvert por pessoa (R$)"));
    await userEvent.type(screen.getByLabelText("Couvert por pessoa (R$)"), "15");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar ajustes" }));

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("/api/staff/restaurant?role=manager");
    expect(init).toMatchObject({ method: "PATCH" });
    expect(init?.body).toBe(
      JSON.stringify({ serviceFeePercent: 12, couvertCents: 1500, requireFirstOrderApproval: false }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Ajustes salvos.");
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("recusa taxa acima do limite e couvert inválido sem chamar a API", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    render(<SettingsForm restaurant={RESTAURANT} onSaved={vi.fn(async () => {})} />);

    await userEvent.clear(screen.getByLabelText("Taxa de serviço (%)"));
    await userEvent.type(screen.getByLabelText("Taxa de serviço (%)"), "45");
    await userEvent.click(screen.getByRole("button", { name: "Salvar ajustes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("de 0 a 30");

    await userEvent.clear(screen.getByLabelText("Taxa de serviço (%)"));
    await userEvent.type(screen.getByLabelText("Taxa de serviço (%)"), "10");
    await userEvent.clear(screen.getByLabelText("Couvert por pessoa (R$)"));
    await userEvent.type(screen.getByLabelText("Couvert por pessoa (R$)"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Salvar ajustes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Couvert inválido");
    expect(spy).not.toHaveBeenCalled();
  });
});
