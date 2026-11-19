"use client";

import { useState, type FormEvent } from "react";
import { CenteredScreen } from "@/components/ui/centered-screen";
import { BUTTON, CARD, INPUT, LABEL } from "@/components/ui/styles";
import type { StaffRole } from "@/lib/api/identity";
import { useApi } from "@/hooks/use-restaurant";

export const ROLE_LABEL: Record<StaffRole, string> = {
  kitchen: "Cozinha e bar",
  waiter: "Garçom",
  manager: "Gerente",
};

type Props = { role: StaffRole; onLoggedIn: () => void };

/** Entrada da equipe com o PIN do papel. O navegador pode entrar em mais de um papel. */
export const StaffLogin = ({ role, onLoggedIn }: Props) => {
  const apiRequest = useApi();
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
    <CenteredScreen>
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
          <p className="text-sm font-medium text-danger" role="alert">
            {message}
          </p>
        )}
        <button type="submit" className={BUTTON.primary} disabled={sending || pin.length === 0}>
          {sending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </CenteredScreen>
  );
};
