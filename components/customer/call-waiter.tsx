"use client";

import { useState, type FormEvent } from "react";
import { BUTTON, CARD, INPUT, LABEL } from "@/components/ui/styles";
import { apiRequest } from "@/lib/api-client";
import { CALL_REASON_LABEL, CALL_STATUS_LABEL } from "@/lib/labels";
import { LIMITS } from "@/lib/store/input";
import type { CustomerView } from "@/lib/views";
import type { CallReason } from "@/types/domain";

type Props = { view: CustomerView; tabId: string | undefined; refresh: () => Promise<void> };

// A conta tem o próprio botão, na seção Conta.
const REASONS: CallReason[] = ["question", "other"];

/** Chama o garçom à mesa e mostra os chamados em andamento. */
export const CallWaiter = ({ view, tabId, refresh }: Props) => {
  const [reason, setReason] = useState<CallReason>("question");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const active = view.calls.filter((call) => call.status !== "resolved");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tabId) return;
    setSending(true);
    setMessage("");
    const response = await apiRequest("/api/customer/calls", {
      method: "POST",
      body: { tabId, reason, message: text },
    });
    setSending(false);
    if (response.ok) setText("");
    else setMessage(response.message);
    await refresh();
  };

  const giveUp = async (callId: string) => {
    await apiRequest(`/api/customer/calls/${callId}/status`, { method: "POST", body: { to: "resolved" } });
    await refresh();
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-chamar">
      <h2 id="titulo-chamar" className="text-xl font-bold">
        Chamar o garçom
      </h2>

      {active.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Chamados em andamento">
          {active.map((call) => (
            <li
              key={call.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-100 p-3 text-sky-950 dark:bg-sky-900/40 dark:text-sky-50"
            >
              <div role="status">
                <p className="font-semibold">{CALL_STATUS_LABEL[call.status]}</p>
                <p className="text-sm">
                  {CALL_REASON_LABEL[call.reason]}
                  {call.message && `: “${call.message}”`}
                </p>
              </div>
              {call.status === "open" && (
                <button type="button" className="min-h-11 text-sm font-semibold underline-offset-2 hover:underline" onClick={() => void giveUp(call.id)}>
                  Não preciso mais
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className={`${CARD} flex flex-col gap-4 p-4`}>
        <fieldset className="flex flex-col gap-2">
          <legend className={LABEL}>Para quê?</legend>
          {REASONS.map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="motivo"
                className="size-5 accent-accent"
                checked={reason === value}
                onChange={() => setReason(value)}
              />
              {CALL_REASON_LABEL[value]}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Recado (opcional)</span>
          <textarea
            className={`${INPUT} min-h-20 py-3`}
            maxLength={LIMITS.callMessage}
            placeholder="Ex.: o risoto tem glúten?"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        {message && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
            {message}
          </p>
        )}
        <button type="submit" className={BUTTON.primary} disabled={sending || !tabId}>
          {sending ? "Chamando…" : "Chamar o garçom"}
        </button>
      </form>
      <p className="text-sm text-muted">Para fechar a conta, use a seção Conta.</p>
    </section>
  );
};
