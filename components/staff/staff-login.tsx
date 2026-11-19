"use client";

import { useState, type FormEvent } from "react";
import { BUTTON, CARD, INPUT, LABEL } from "@/components/ui/styles";
import type { StaffRole } from "@/lib/api/identity";
import { apiRequest } from "@/lib/api-client";

export const ROLE_LABEL: Record<StaffRole, string> = {
  kitchen: "Cozinha e bar",
  waiter: "Garçom",
  manager: "Gerente",
};

type Props = { role: StaffRole; onLoggedIn: () => void };

/** Entrada da equipe com o PIN do papel. O navegador pode entrar em mais de um papel. */
export const StaffLogin = ({ role, onLoggedIn }: Props) => {
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const response = await apiRequest("/api/staff/login", { method: "POST", body: { role, pin } });
    setSending(false);
    if (response.ok) onLoggedIn();
    else {
      setMessage(response.message);
      setPin("");
    }
  };

  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <form onSubmit={submit} className={`${CARD} flex flex-col gap-4 p-6`}>
        <div>
          <p className="text-sm font-semibold text-accent">Equipe</p>
          <h1 className="mt-1 text-2xl font-bold">{ROLE_LABEL[role]}</h1>
          <p className="mt-2 text-muted">Digite o seu PIN pessoal para usar esta tela neste aparelho.</p>
        </div>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>PIN</span>
          <input
            className={`${INPUT} text-center font-mono text-2xl tracking-[0.5em]`}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            required
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
          />
        </label>
        {message && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
            {message}
          </p>
        )}
        <button type="submit" className={BUTTON.primary} disabled={sending || pin.length === 0}>
          {sending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
};
