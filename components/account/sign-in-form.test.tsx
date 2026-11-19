import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "@/components/account/sign-in-form";

const auth = vi.hoisted(() => ({
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({ authClient: auth }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("SignInForm", () => {
  it("entra com e-mail e senha", async () => {
    auth.signIn.email.mockResolvedValue({ data: {}, error: null });
    const onSignedIn = vi.fn();
    render(<SignInForm onSignedIn={onSignedIn} />);
    await userEvent.type(screen.getByLabelText("E-mail"), " dono@exemplo.com ");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-forte-1");
    await userEvent.click(screen.getByRole("button", { name: "Entrar na conta" }));
    expect(auth.signIn.email).toHaveBeenCalledWith({ email: "dono@exemplo.com", password: "senha-forte-1" });
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it("cria a conta com nome, e-mail e senha", async () => {
    auth.signUp.email.mockResolvedValue({ data: {}, error: null });
    const onSignedIn = vi.fn();
    render(<SignInForm onSignedIn={onSignedIn} />);
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(screen.getByRole("heading", { name: "Criar sua conta" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Seu nome"), "Diego");
    await userEvent.type(screen.getByLabelText("E-mail"), "dono@exemplo.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-forte-1");
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription("Pelo menos 8 caracteres.");
    await userEvent.click(screen.getByRole("button", { name: "Criar minha conta" }));
    expect(auth.signUp.email).toHaveBeenCalledWith({ name: "Diego", email: "dono@exemplo.com", password: "senha-forte-1" });
    expect(onSignedIn).toHaveBeenCalledOnce();
  });

  it("mostra o erro em português e limpa a senha", async () => {
    auth.signIn.email.mockResolvedValue({ data: null, error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });
    const onSignedIn = vi.fn();
    render(<SignInForm onSignedIn={onSignedIn} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "dono@exemplo.com");
    await userEvent.type(screen.getByLabelText("Senha"), "errada-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar na conta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha errados.");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
