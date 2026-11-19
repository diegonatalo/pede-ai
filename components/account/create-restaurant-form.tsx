"use client";

import { useId, useState, type FormEvent } from "react";
import { BUTTON, INPUT, LABEL } from "@/components/ui/styles";
import { apiRequest } from "@/lib/api-client";
import { slugify } from "@/lib/restaurant-template";
import type { RestaurantRecord } from "@/types/store";

type Props = { onCreated: (restaurant: RestaurantRecord, pin: string) => void };

/** Cadastro do restaurante: nome e endereço (sugerido pelo nome até a pessoa mexer nele). */
export const CreateRestaurantForm = ({ onCreated }: Props) => {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const helpId = useId();

  const address = slugEdited ? slug : slugify(name);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const response = await apiRequest<{ restaurant: RestaurantRecord; pin: string }>("/api/account/restaurants", {
      method: "POST",
      body: { name: name.trim(), slug: address },
    });
    setSending(false);
    if (!response.ok) {
      setMessage(response.message);
      return;
    }
    setName("");
    setSlug("");
    setSlugEdited(false);
    onCreated(response.data.restaurant, response.data.pin);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Cadastrar restaurante">
      <label className="flex flex-col gap-2">
        <span className={LABEL}>Nome do restaurante</span>
        <input
          className={INPUT}
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className={LABEL}>Endereço</span>
        <input
          className={`${INPUT} font-mono`}
          required
          maxLength={40}
          value={address}
          aria-describedby={helpId}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value.toLowerCase());
          }}
        />
      </label>
      <p id={helpId} className="-mt-2 text-sm text-muted">
        As telas ficam em /r/{address || "seu-restaurante"}. Letras minúsculas, números e hífens.
      </p>
      {message && (
        <p className="rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger" role="alert">
          {message}
        </p>
      )}
      <button type="submit" className={`${BUTTON.primary} self-start`} disabled={sending || !name.trim() || !address}>
        {sending ? "Criando…" : "Criar restaurante"}
      </button>
    </form>
  );
};
