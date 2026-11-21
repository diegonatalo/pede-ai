"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CenteredScreen } from "@/components/ui/centered-screen";
import { BUTTON, CARD, INPUT, LABEL } from "@/components/ui/styles";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/messages";
import { RETURN_PARAM, safeReturnPath } from "@/lib/auth/paths";
import { cn } from "@/lib/cn";
import { TERMS_VERSION } from "@/lib/terms";

type Mode = "sign-in" | "sign-up";

/** Navegação completa: o servidor (e o proxy) passam a ver o cookie novo da sessão. */
const goToAccount = () =>
  window.location.assign(safeReturnPath(new URLSearchParams(window.location.search).get(RETURN_PARAM)));

/** Entrar ou criar a conta do dono do restaurante, com e-mail e senha. */
export const SignInForm = ({ onSignedIn = goToAccount }: { onSignedIn?: () => void }) => {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const switchTo = (next: Mode) => {
    setMode(next);
    setMessage("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
            termsVersion: acceptedTerms ? TERMS_VERSION : undefined,
          })
        : await authClient.signIn.email({ email: email.trim(), password });
    setSending(false);
    if (error) {
      setMessage(authErrorMessage(error));
      setPassword("");
    } else {
      onSignedIn();
    }
  };

  return (
    <CenteredScreen>
      <form onSubmit={submit} className={`${CARD} flex flex-col gap-4 p-6`}>
        <div>
          <p className="text-sm font-semibold text-accent">Para restaurantes</p>
          <h1 className="mt-1 text-2xl font-bold">{mode === "sign-in" ? "Entrar na sua conta" : "Criar sua conta"}</h1>
        </div>

        <div role="group" aria-label="Escolha" className="grid grid-cols-2 rounded-full border border-border p-1">
          {(
            [
              ["sign-in", "Entrar"],
              ["sign-up", "Criar conta"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => switchTo(id)}
              className={cn(
                "min-h-10 rounded-full text-sm font-semibold",
                mode === id ? "bg-accent text-on-accent" : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "sign-up" && (
          <label className="flex flex-col gap-2">
            <span className={LABEL}>Seu nome</span>
            <input className={INPUT} autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        )}
        <label className="flex flex-col gap-2">
          <span className={LABEL}>E-mail</span>
          <input
            className={INPUT}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2">
            <span className={LABEL}>Senha</span>
            <input
              className={INPUT}
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={mode === "sign-up" ? 8 : undefined}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={mode === "sign-up" ? "ajuda-senha" : undefined}
            />
          </label>
          {mode === "sign-up" && (
            <p id="ajuda-senha" className="text-sm text-muted">
              Pelo menos 8 caracteres.
            </p>
          )}
        </div>

        {mode === "sign-up" && (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-5 accent-accent"
              required
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span>
              Li e aceito os{" "}
              <Link href="/termos" target="_blank" className="font-semibold text-accent underline-offset-2 hover:underline">
                termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className="font-semibold text-accent underline-offset-2 hover:underline">
                política de privacidade
              </Link>
              .
            </span>
          </label>
        )}

        {message && (
          <p className="text-sm font-medium text-danger" role="alert">
            {message}
          </p>
        )}
        <button type="submit" className={BUTTON.primary} disabled={sending}>
          {sending ? "Aguarde…" : mode === "sign-in" ? "Entrar na conta" : "Criar minha conta"}
        </button>
        {mode === "sign-in" && (
          <p className="text-sm text-muted">
            Esqueceu a senha? Por enquanto, fale com o suporte do Pede Aí para redefinir.
          </p>
        )}
        <p className="text-xs text-muted">
          <Link href="/privacidade" className="underline hover:text-foreground">
            Como cuidamos dos seus dados
          </Link>
        </p>
      </form>
    </CenteredScreen>
  );
};
