"use client";

import { useState } from "react";
import { SplitItemForm } from "@/components/customer/split-item-form";
import { BUTTON, CARD } from "@/components/ui/styles";
import { useApi } from "@/hooks/use-restaurant";
import { computeTabBill } from "@/lib/billing";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import { describeSplit } from "@/lib/split";
import type { CustomerView } from "@/lib/views";

type Props = { view: CustomerView; refresh: () => Promise<void> };

/** Conta de cada comanda do aparelho, com divisão de itens e o pedido da conta ao garçom. */
export const BillView = ({ view, refresh }: Props) => {
  const apiRequest = useApi();
  const [splitting, setSplitting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const ownerOf = (orderId: string) => view.orders.find((order) => order.id === orderId)?.tabId;
  const myTabs = view.tabs.filter((tab) => tab.mine);

  const requestBill = async (tabId: string) => {
    setBusy(tabId);
    setMessage("");
    const response = await apiRequest(`/api/customer/tabs/${tabId}/status`, { method: "POST", body: { to: "bill_requested" } });
    if (response.ok) {
      // Avisa o garçom também pelos chamados, onde ele recebe o bipe.
      await apiRequest("/api/customer/calls", { method: "POST", body: { tabId, reason: "bill" } });
    } else {
      setMessage(response.message);
    }
    setBusy(null);
    await refresh();
  };

  const reopen = async (tabId: string) => {
    setBusy(tabId);
    const response = await apiRequest(`/api/customer/tabs/${tabId}/status`, { method: "POST", body: { to: "open" } });
    if (!response.ok) setMessage(response.message);
    setBusy(null);
    await refresh();
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-conta">
      <h2 id="titulo-conta" className="text-xl font-bold">
        Conta
      </h2>
      {message && (
        <p className="text-sm font-medium text-danger" role="alert">
          {message}
        </p>
      )}
      {myTabs.map((tab) => {
        const bill = computeTabBill(tab, view.items, view.restaurant);
        return (
          <article key={tab.id} className={cn(CARD, "flex flex-col gap-3 p-4")} aria-label={`Conta de ${tab.customerName}`}>
            <header className="flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-bold">{tab.customerName}</h3>
              <span className="text-sm text-muted">
                {tab.peopleCount} {tab.peopleCount === 1 ? "pessoa" : "pessoas"}
              </span>
            </header>

            {bill.lines.length === 0 ? (
              <p className="text-sm text-muted">Nada na conta ainda.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {bill.lines.map((line) => {
                  const item = view.items.find((entry) => entry.id === line.itemId);
                  if (!item) return null;
                  const canSplit = ownerOf(item.orderId) === tab.id && (tab.status === "open" || tab.status === "bill_requested");
                  return (
                    <li key={line.itemId} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {line.quantity}× {line.name}
                          </p>
                          <p className="text-sm text-muted">
                            {describeSplit(item, view.tabs, tab.id)}
                            {line.pending && " · ainda não chegou"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-semibold">{formatCents(line.amountCents)}</span>
                          {canSplit && splitting !== item.id && (
                            <button
                              type="button"
                              className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
                              onClick={() => setSplitting(item.id)}
                              aria-label={`Dividir ${line.name}`}
                            >
                              Dividir
                            </button>
                          )}
                        </div>
                      </div>
                      {splitting === item.id && (
                        <SplitItemForm
                          item={item}
                          tabs={view.tabs}
                          onDone={(saved) => {
                            setSplitting(null);
                            if (saved) void refresh();
                          }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
              <dt className="text-muted">Itens</dt>
              <dd className="text-right">{formatCents(bill.subtotalCents)}</dd>
              <dt className="text-muted">Taxa de serviço ({view.restaurant.serviceFeePercent}%)</dt>
              <dd className="text-right">{formatCents(bill.serviceFeeCents)}</dd>
              {bill.couvertCents > 0 && (
                <>
                  <dt className="text-muted">Couvert ({tab.peopleCount}×)</dt>
                  <dd className="text-right">{formatCents(bill.couvertCents)}</dd>
                </>
              )}
              <dt className="text-base font-bold">Total</dt>
              <dd className="text-right text-base font-bold">{formatCents(bill.totalCents)}</dd>
            </dl>

            {bill.pendingCount > 0 && tab.status === "open" && (
              <p className="text-sm text-muted">
                {bill.pendingCount === 1 ? "1 item ainda não chegou" : `${bill.pendingCount} itens ainda não chegaram`} e
                já está na conta.
              </p>
            )}

            {tab.status === "open" && (
              <button type="button" className={BUTTON.primary} disabled={busy === tab.id} onClick={() => void requestBill(tab.id)}>
                Pedir a conta de {tab.customerName}
              </button>
            )}
            {tab.status === "bill_requested" && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-info-soft p-3 text-info">
                <p className="font-semibold" role="status">
                  Conta pedida. O garçom já vem.
                </p>
                <button type="button" className={BUTTON.smallGhost} disabled={busy === tab.id} onClick={() => void reopen(tab.id)}>
                  Quero pedir mais
                </button>
              </div>
            )}
            {tab.status === "paid" && (
              <p className="rounded-2xl bg-success-soft p-3 font-semibold text-success">
                Conta paga. Obrigado!
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
};
