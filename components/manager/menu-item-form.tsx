"use client";

import { useState, type FormEvent } from "react";
import { CameraIcon } from "@/components/ui/icons";
import { MenuPhoto } from "@/components/ui/menu-photo";
import { BUTTON, INPUT, LABEL, SELECT } from "@/components/ui/styles";
import { STATION_LABEL } from "@/lib/labels";
import { MENU_LIMITS } from "@/lib/menu-editor";
import { formatCents, parseCents } from "@/lib/money";
import type { MenuCategory, MenuItem, Station } from "@/types/domain";

export type MenuItemFields = Pick<MenuItem, "categoryId" | "name" | "description" | "priceCents" | "station">;

type Props = {
  categories: MenuCategory[];
  /** Item em edição; sem ele, o formulário cria um novo na `categoryId`. */
  item?: MenuItem;
  categoryId: string;
  busy: boolean;
  onSubmit: (fields: MenuItemFields) => Promise<boolean>;
  onCancel: () => void;
};

const STATIONS: Station[] = ["kitchen", "bar"];

/** Preço digitável sem o "R$": 1250 → "12,50". */
const priceText = (cents: number) => formatCents(cents).replace(/^R\$\s*/, "");

/** Criar ou editar um item do cardápio. */
export const MenuItemForm = ({ categories, item, categoryId, busy, onSubmit, onCancel }: Props) => {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? priceText(item.priceCents) : "");
  const [station, setStation] = useState<Station>(item?.station ?? "kitchen");
  const [category, setCategory] = useState(item?.categoryId ?? categoryId);
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const priceCents = parseCents(price);
    if (priceCents === null || priceCents > MENU_LIMITS.maxPriceCents) {
      setMessage("Digite o preço em reais, como 12,50.");
      return;
    }
    setMessage("");
    const saved = await onSubmit({ categoryId: category, name: name.trim(), description: description.trim(), priceCents, station });
    if (saved) onCancel();
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4"
      aria-label={item ? `Editar ${item.name}` : "Novo item"}
    >
      <div className="flex items-center gap-4">
        <MenuPhoto src={item?.photoUrl} alt={item?.name ?? "Novo item"} sizes="96px" className="size-24 rounded-2xl" />
        <div className="flex flex-col gap-1">
          <p className={LABEL}>Foto</p>
          <p className="text-sm text-muted">
            {item?.photoUrl ? "Foto do item no cardápio." : "Por enquanto aparece esta ilustração. O envio de fotos chega na próxima versão."}
          </p>
          <button type="button" className={`${BUTTON.small} mt-1 self-start`} disabled>
            <CameraIcon className="size-4" />
            Enviar foto (em breve)
          </button>
        </div>
      </div>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Nome</span>
        <input
          className={INPUT}
          required
          maxLength={MENU_LIMITS.itemName}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Descrição</span>
        <textarea
          className={`${INPUT} min-h-20 py-2`}
          maxLength={MENU_LIMITS.description}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Preço (R$)</span>
          <input
            className={INPUT}
            required
            inputMode="decimal"
            placeholder="0,00"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Preparo</span>
          <select
            className={SELECT}
            value={station}
            onChange={(event) => setStation(event.target.value as Station)}
          >
            {STATIONS.map((entry) => (
              <option key={entry} value={entry}>
                {STATION_LABEL[entry]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Categoria</span>
          <select
            className={SELECT}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message && (
        <p className="text-sm font-medium text-danger" role="alert">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BUTTON.primary} disabled={busy || !name.trim() || !price.trim()}>
          {item ? "Salvar item" : "Adicionar item"}
        </button>
        <button type="button" className={BUTTON.ghost} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
};
