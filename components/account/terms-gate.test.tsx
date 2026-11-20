import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TermsGate } from "@/components/account/terms-gate";
import { TERMS_VERSION } from "@/lib/terms";

const auth = vi.hoisted(() => ({ updateUser: vi.fn() }));

vi.mock("@/lib/auth/client", () => ({ authClient: auth }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("TermsGate", () => {
  it("grava o aceite da versão atual e continua", async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    const onAccepted = vi.fn();
    render(<TermsGate updated={false} onAccepted={onAccepted} onSignOut={() => {}} />);
    expect(screen.getByRole("heading", { name: "Aceite os termos de uso" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Li e aceito/ }));
    await userEvent.click(screen.getByRole("button", { name: "Aceitar e continuar" }));
    expect(auth.updateUser).toHaveBeenCalledWith({ termsVersion: TERMS_VERSION });
    expect(onAccepted).toHaveBeenCalledOnce();
  });

  it("não envia sem marcar a caixa", async () => {
    render(<TermsGate updated onAccepted={() => {}} onSignOut={() => {}} />);
    expect(screen.getByRole("heading", { name: "Os termos de uso mudaram" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aceitar e continuar" }));
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("mostra o erro e deixa sair", async () => {
    auth.updateUser.mockResolvedValue({ data: null, error: { code: "TERMS_NOT_ACCEPTED", status: 400 } });
    const onSignOut = vi.fn();
    render(<TermsGate updated={false} onAccepted={() => {}} onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Li e aceito/ }));
    await userEvent.click(screen.getByRole("button", { name: "Aceitar e continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Para continuar, aceite os termos de uso.");
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("liga para os termos e a política", () => {
    render(<TermsGate updated={false} onAccepted={() => {}} onSignOut={() => {}} />);
    expect(screen.getByRole("link", { name: "termos de uso" })).toHaveAttribute("href", "/termos");
    expect(screen.getByRole("link", { name: "política de privacidade" })).toHaveAttribute("href", "/privacidade");
  });
});
