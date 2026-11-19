"use client";

import { useState, type FormEvent } from "react";
import { BUTTON, CARD, INPUT, LABEL } from "@/components/ui/styles";
import { apiRequest } from "@/lib/api-client";
import { LIMITS } from "@/lib/store/input";
import type { Tab } from "@/types/domain";

type Props = {
  /** `self` na primeira comanda do aparelho; `other` para alguém sem celular. */
  mode: "self" | "other";
  onCreated: (tab: Tab) => void;
  onCancel?: () => void;
};

/** Abre uma comanda: nome que aparece para a mesa e para o garçom, e quantas pessoas ela cobre. */
export const CreateTabForm = ({ mode, onCreated, onCancel }: Props) => {
  const [name, setName] = useState("");
  const [people, setPeople] = useState(1);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const response = await apiRequest<Tab>("/api/customer/tabs", {
      method: "POST",
      body: { customerName: name, peopleCount: people },
    });
    setSending(false);
    if (response.ok) onCreated(response.data);
    else setMessage(response.message);
  };

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-col gap-4 p-6`}>
      <div>
        <h1 className="text-2xl font-bold">{mode === "self" ? "Abra a sua comanda" : "Comanda para outra pessoa"}</h1>
        <p className="mt-2 text-muted">
          {mode === "self"
            ? "Cada pessoa (ou casal) da mesa tem a própria comanda, e a conta sai separada."
            : "Para quem está na mesa sem celular. Os pedidos dela ficam neste aparelho."}
        </p>
      </div>
      <label className="flex flex-col gap-2">
        <span className={LABEL}>{mode === "self" ? "Como podemos te chamar?" : "Nome da pessoa"}</span>
        <input
          className={INPUT}
          autoComplete={mode === "self" ? "given-name" : "off"}
          maxLength={LIMITS.customerName}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={mode === "self" ? "Ex.: Ana, ou Ana e Rui" : "Ex.: Vó Lúcia"}
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className={LABEL}>Quantas pessoas nesta comanda?</legend>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={BUTTON.icon}
            aria-label="Uma pessoa a menos"
            disabled={people <= 1}
            onClick={() => setPeople((value) => Math.max(1, value - 1))}
          >
            −
          </button>
          <output className="min-w-10 text-center text-xl font-bold" aria-live="polite">
            {people}
          </output>
          <button
            type="button"
            className={BUTTON.icon}
            aria-label="Uma pessoa a mais"
            disabled={people >= LIMITS.peopleCount}
            onClick={() => setPeople((value) => Math.min(LIMITS.peopleCount, value + 1))}
          >
            +
          </button>
          <span className="text-sm text-muted">{people === 2 ? "Um casal, por exemplo" : null}</span>
        </div>
      </fieldset>
      {message && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={BUTTON.primary} disabled={sending || !name.trim()}>
          {sending ? "Abrindo…" : "Abrir comanda"}
        </button>
        {onCancel && (
          <button type="button" className={BUTTON.ghost} onClick={onCancel}>
            Voltar
          </button>
        )}
      </div>
    </form>
  );
};
