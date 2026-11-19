"use client";

import { useState } from "react";
import { BUTTON } from "@/components/ui/styles";
import { apiRequest } from "@/lib/api-client";
import { allocateCents, itemTotal } from "@/lib/billing";
import { formatCents } from "@/lib/money";
import { MAX_PARTS, draftFromItem, draftToShares, setParts, splittableTabs } from "@/lib/split";
import type { CustomerTab } from "@/lib/views";
import type { OrderItem } from "@/types/domain";

type Props = {
  item: OrderItem;
  tabs: CustomerTab[];
  onDone: (saved: boolean) => void;
};

/**
 * Divide um item entre comandas da mesa. Cada comanda marcada entra com 1 parte;
 * mais partes servem para quem comeu mais (ex.: o casal fica com 2 de 3).
 */
export const SplitItemForm = ({ item, tabs, onDone }: Props) => {
  const options = splittableTabs(tabs);
  const [draft, setDraft] = useState(() => draftFromItem(item, options));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const shares = draftToShares(draft, options);
  const amounts = shares.length > 0 ? allocateCents(itemTotal(item), shares.map((share) => share.parts)) : [];
  const amountOf = (tabId: string) => amounts[shares.findIndex((share) => share.tabId === tabId)];

  const save = async () => {
    setSaving(true);
    setMessage("");
    const response = await apiRequest(`/api/customer/items/${item.id}/shares`, { method: "POST", body: { shares } });
    setSaving(false);
    if (response.ok) onDone(true);
    else setMessage(response.message);
  };

  return (
    <fieldset className="mt-3 flex flex-col gap-3 rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-semibold">Dividir {item.nameSnapshot} com…</legend>
      <ul className="flex flex-col gap-2">
        {options.map((tab) => {
          const parts = draft[tab.id] ?? 0;
          const name = tab.mine ? `${tab.customerName} (você)` : tab.customerName;
          return (
            <li key={tab.id} className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-accent"
                  checked={parts > 0}
                  onChange={(event) => setDraft(setParts(draft, tab.id, event.target.checked ? 1 : 0))}
                />
                <span>{name}</span>
              </label>
              {parts > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    className={`${BUTTON.icon} size-9`}
                    aria-label={`Uma parte a menos para ${tab.customerName}`}
                    disabled={parts <= 1}
                    onClick={() => setDraft(setParts(draft, tab.id, parts - 1))}
                  >
                    −
                  </button>
                  <span className="min-w-14 text-center">
                    {parts} {parts === 1 ? "parte" : "partes"}
                  </span>
                  <button
                    type="button"
                    className={`${BUTTON.icon} size-9`}
                    aria-label={`Uma parte a mais para ${tab.customerName}`}
                    disabled={parts >= MAX_PARTS}
                    onClick={() => setDraft(setParts(draft, tab.id, parts + 1))}
                  >
                    +
                  </button>
                  <span className="min-w-20 text-right font-semibold">{formatCents(amountOf(tab.id) ?? 0)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {options.length === 1 && (
        <p className="text-sm text-muted">
          Só há uma comanda na mesa. Quem está sem celular pode ganhar uma em “Comanda”, no topo da tela.
        </p>
      )}
      {shares.length === 0 && <p className="text-sm text-muted">Marque pelo menos uma comanda.</p>}
      {message && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON.primary} disabled={saving || shares.length === 0} onClick={() => void save()}>
          {saving ? "Salvando…" : "Salvar divisão"}
        </button>
        <button type="button" className={BUTTON.ghost} onClick={() => onDone(false)}>
          Cancelar
        </button>
      </div>
    </fieldset>
  );
};
