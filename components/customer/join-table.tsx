"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BUTTON, CARD, INPUT, LABEL } from "@/components/ui/styles";
import { useApi } from "@/hooks/use-restaurant";
import type { Api, ApiResponse } from "@/lib/api-client";
import type { Table } from "@/types/domain";

type Props = { tableId: string; onJoined: () => void };

type TableStatus = { table: Table | null; open: boolean };

const fetchTable = (apiRequest: Api, tableId: string) => apiRequest<TableStatus>(`/api/tables/${encodeURIComponent(tableId)}`);

/** Primeira tela do QR code: confere se a mesa está aberta e pede o código do garçom. */
export const JoinTable = ({ tableId, onJoined }: Props) => {
  const apiRequest = useApi();
  const [status, setStatus] = useState<TableStatus | "missing" | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const apply = (response: ApiResponse<TableStatus>) => {
    if (response.ok) setStatus(response.data.table ? response.data : "missing");
    else setMessage(response.message);
  };

  const load = async () => apply(await fetchTable(apiRequest, tableId));

  useEffect(() => {
    let active = true;
    void fetchTable(apiRequest, tableId).then((response) => {
      if (!active) return;
      if (response.ok) setStatus(response.data.table ? response.data : "missing");
      else setMessage(response.message);
    });
    return () => {
      active = false;
    };
  }, [apiRequest, tableId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const response = await apiRequest(`/api/tables/${encodeURIComponent(tableId)}/join`, {
      method: "POST",
      body: { code },
    });
    setSending(false);
    if (response.ok) onJoined();
    else setMessage(response.message);
  };

  if (status === "missing") {
    return (
      <section className={`${CARD} p-6 text-center`}>
        <h1 className="text-2xl font-bold">Mesa não encontrada</h1>
        <p className="mt-2 text-muted">Esse QR code não é de uma mesa deste restaurante. Peça ajuda ao garçom.</p>
      </section>
    );
  }

  if (status === null || !status.table) {
    return (
      <p className="py-10 text-center text-muted" role="status">
        {message || "Carregando a mesa…"}
      </p>
    );
  }

  if (!status.open) {
    return (
      <section className={`${CARD} p-6 text-center`}>
        <p className="text-sm font-semibold text-accent">{status.table.label}</p>
        <h1 className="mt-1 text-2xl font-bold">A mesa ainda não foi aberta</h1>
        <p className="mt-2 text-muted">Chame o garçom: ele abre a mesa e passa o código para vocês pedirem.</p>
        <button type="button" className={`${BUTTON.secondary} mt-6`} onClick={() => void load()}>
          Já abriram, tentar de novo
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-col gap-4 p-6`}>
      <div>
        <p className="text-sm font-semibold text-accent">{status.table.label}</p>
        <h1 className="mt-1 text-2xl font-bold">Bem-vindo! Digite o código da mesa</h1>
        <p className="mt-2 text-muted">São 4 números. O garçom informa quando abre a mesa.</p>
      </div>
      <label className="flex flex-col gap-2">
        <span className={LABEL}>Código da mesa</span>
        <input
          className={`${INPUT} text-center font-mono text-2xl tracking-[0.5em]`}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{4}"
          maxLength={4}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
        />
      </label>
      {message && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
          {message}
        </p>
      )}
      <button type="submit" className={BUTTON.primary} disabled={sending || code.length !== 4}>
        {sending ? "Entrando…" : "Entrar na mesa"}
      </button>
    </form>
  );
};
