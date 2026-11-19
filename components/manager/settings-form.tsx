"use client";

import { useState, type FormEvent } from "react";
import { BUTTON, CARD, INPUT, LABEL } from "@/components/ui/styles";
import { apiRequest } from "@/lib/api-client";
import { formatCents, parseCents } from "@/lib/money";
import { LIMITS } from "@/lib/store/input";
import type { Restaurant } from "@/types/domain";

type Props = { restaurant: Restaurant; onSaved: () => Promise<void> };

/** Taxa de serviço, couvert e a confirmação do primeiro pedido. */
export const SettingsForm = ({ restaurant, onSaved }: Props) => {
  const [fee, setFee] = useState(String(restaurant.serviceFeePercent));
  const [couvert, setCouvert] = useState(formatCents(restaurant.couvertCents).replace(/R\$\s?/, ""));
  const [approval, setApproval] = useState(restaurant.requireFirstOrderApproval);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const serviceFeePercent = Number(fee);
    const couvertCents = parseCents(couvert);
    if (!Number.isInteger(serviceFeePercent) || serviceFeePercent < 0 || serviceFeePercent > LIMITS.serviceFeePercent) {
      setMessage({ ok: false, text: `A taxa precisa ser um número inteiro de 0 a ${LIMITS.serviceFeePercent}.` });
      return;
    }
    if (couvertCents === null || couvertCents > LIMITS.couvertCents) {
      setMessage({ ok: false, text: `Couvert inválido. Use um valor como 15,00 (até ${formatCents(LIMITS.couvertCents)}).` });
      return;
    }
    setSaving(true);
    setMessage(null);
    const response = await apiRequest("/api/staff/restaurant?role=manager", {
      method: "PATCH",
      body: { serviceFeePercent, couvertCents, requireFirstOrderApproval: approval },
    });
    setSaving(false);
    setMessage(response.ok ? { ok: true, text: "Ajustes salvos." } : { ok: false, text: response.message });
    if (response.ok) await onSaved();
  };

  return (
    <form onSubmit={submit} className={`${CARD} flex max-w-lg flex-col gap-5 p-6`}>
      {/* A ajuda fica fora do label: entra como descrição, não como parte do nome do campo. */}
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Taxa de serviço (%)</span>
          <input
            className={INPUT}
            inputMode="numeric"
            value={fee}
            onChange={(event) => setFee(event.target.value.replace(/\D/g, "").slice(0, 2))}
            aria-describedby="ajuda-taxa"
          />
        </label>
        <p id="ajuda-taxa" className="text-sm text-muted">
          Cobrada sobre os itens de cada comanda. Use 0 para não cobrar.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Couvert por pessoa (R$)</span>
          <input
            className={INPUT}
            inputMode="decimal"
            value={couvert}
            onChange={(event) => setCouvert(event.target.value)}
            aria-describedby="ajuda-couvert"
          />
        </label>
        <p id="ajuda-couvert" className="text-sm text-muted">
          Multiplicado pelo número de pessoas da comanda, sem taxa de serviço.
        </p>
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-accent"
          checked={approval}
          onChange={(event) => setApproval(event.target.checked)}
        />
        <span>
          <span className="block font-semibold">Garçom confirma o primeiro pedido de cada comanda</span>
          <span className="text-sm text-muted">
            Evita pedidos de quem não está na mesa (por exemplo, com a foto do QR code).
          </span>
        </span>
      </label>
      {message && (
        <p
          className={message.ok ? "text-sm font-medium text-emerald-700 dark:text-emerald-400" : "text-sm font-medium text-red-700 dark:text-red-400"}
          role={message.ok ? "status" : "alert"}
        >
          {message.text}
        </p>
      )}
      <button type="submit" className={`${BUTTON.primary} self-start`} disabled={saving}>
        {saving ? "Salvando…" : "Salvar ajustes"}
      </button>
    </form>
  );
};
