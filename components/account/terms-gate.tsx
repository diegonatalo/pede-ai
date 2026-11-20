"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CenteredScreen } from "@/components/ui/centered-screen";
import { BUTTON, CARD } from "@/components/ui/styles";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/messages";
import { TERMS_VERSION } from "@/lib/terms";

type Props = {
  /** O dono já aceitou alguma versão antes (muda só o texto do título). */
  updated: boolean;
  onAccepted: () => void;
  onSignOut: () => void;
};

/** Pede o aceite da versão atual dos termos antes de abrir a conta do dono. */
export const TermsGate = ({ updated, onAccepted, onSignOut }: Props) => {
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const { error } = await authClient.updateUser({ termsVersion: TERMS_VERSION });
    setSending(false);
    if (error) setMessage(authErrorMessage(error));
    else onAccepted();
  };

  return (
    <CenteredScreen>
      <form onSubmit={submit} className={`${CARD} flex flex-col gap-4 p-6`}>
        <div>
          <p className="text-sm font-semibold text-accent">Sua conta</p>
          <h1 className="mt-1 text-2xl font-bold">{updated ? "Os termos de uso mudaram" : "Aceite os termos de uso"}</h1>
        </div>
        <p className="text-muted">
          Para continuar usando o Pede Aí, leia e aceite os termos de uso. Eles dizem o que o Pede Aí faz, o que o
          restaurante faz com os dados dos clientes dele e como excluir a conta.
        </p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 accent-accent"
            required
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
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
        {message && (
          <p className="text-sm font-medium text-danger" role="alert">
            {message}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={BUTTON.primary} disabled={sending}>
            {sending ? "Aguarde…" : "Aceitar e continuar"}
          </button>
          <button type="button" className={BUTTON.secondary} onClick={onSignOut}>
            Sair
          </button>
        </div>
      </form>
    </CenteredScreen>
  );
};
