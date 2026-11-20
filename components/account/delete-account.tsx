"use client";

import { useState, type FormEvent } from "react";
import { BUTTON, INPUT, LABEL } from "@/components/ui/styles";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/messages";

/** Excluir a própria conta (e os restaurantes dela), confirmando com a senha. */
export const DeleteAccount = ({ onDeleted }: { onDeleted: () => void }) => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) {
    return (
      <button type="button" className={`${BUTTON.smallGhost} self-start text-danger`} onClick={() => setOpen(true)}>
        Excluir minha conta
      </button>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const { error } = await authClient.deleteUser({ password });
    setSending(false);
    if (error) {
      setMessage(authErrorMessage(error));
      setPassword("");
      return;
    }
    onDeleted();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-danger-soft p-4" aria-label="Excluir minha conta">
      <p className="text-sm font-medium text-danger">
        Isso apaga a sua conta e todos os seus restaurantes, com cardápio, mesas, equipe, pedidos e números. Não tem como
        desfazer.
      </p>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Sua senha</span>
        <input
          className={INPUT}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {message && (
        <p className="text-sm font-medium text-danger" role="alert">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BUTTON.danger} disabled={sending || !password}>
          {sending ? "Excluindo…" : "Excluir conta para sempre"}
        </button>
        <button
          type="button"
          className={BUTTON.ghost}
          onClick={() => {
            setOpen(false);
            setPassword("");
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};
