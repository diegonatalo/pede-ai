import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffLogin } from "@/components/staff/staff-login";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StaffLogin", () => {
  it("entra com o PIN do papel", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ roles: ["waiter"] }));
    const onLoggedIn = vi.fn();
    render(<StaffLogin role="waiter" onLoggedIn={onLoggedIn} />);
    expect(screen.getByRole("heading", { name: "Garçom" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("PIN"), "22a22");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(onLoggedIn).toHaveBeenCalledOnce();
    const [, init] = spy.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ role: "waiter", pin: "2222" }));
  });

  it("mostra o erro e limpa o PIN errado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "wrong_pin", message: "PIN errado." }, { status: 401 }),
    );
    const onLoggedIn = vi.fn();
    render(<StaffLogin role="kitchen" onLoggedIn={onLoggedIn} />);
    await userEvent.type(screen.getByLabelText("PIN"), "9999");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("PIN errado.");
    expect(screen.getByLabelText("PIN")).toHaveValue("");
    expect(onLoggedIn).not.toHaveBeenCalled();
  });
});
