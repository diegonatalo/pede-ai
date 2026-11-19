"use client";

import { ItemStatusBadge } from "@/components/customer/item-status-badge";
import { BUTTON, CARD } from "@/components/ui/styles";
import { checkItemTransition } from "@/lib/transitions";
import type { CustomerView } from "@/lib/views";

type Props = {
  view: CustomerView;
  onCancel: (itemId: string) => void;
  busyItemId: string | null;
  onBrowse: () => void;
};

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Pedidos das comandas do aparelho, do mais novo para o mais antigo, com o estado de cada item. */
export const OrdersList = ({ view, onCancel, busyItemId, onBrowse }: Props) => {
  const tabName = new Map(view.tabs.map((tab) => [tab.id, tab.customerName]));
  const orders = [...view.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const waiting = view.items.some((item) => item.status === "awaiting_approval");

  if (orders.length === 0) {
    return (
      <section className={`${CARD} p-6 text-center`}>
        <h2 className="text-xl font-bold">Nenhum pedido ainda</h2>
        <p className="mt-2 text-muted">Os pedidos aparecem aqui, com o andamento de cada item.</p>
        <button type="button" className={`${BUTTON.primary} mt-6`} onClick={onBrowse}>
          Ver o cardápio
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-pedidos">
      <h2 id="titulo-pedidos" className="text-xl font-bold">
        Seus pedidos
      </h2>
      {waiting && (
        <p className="rounded-2xl bg-warning-soft p-3 text-sm font-medium text-warning" role="status">
          O garçom vai confirmar seu primeiro pedido e ele segue para a cozinha.
        </p>
      )}
      {orders.map((order) => (
        <article key={order.id} className={`${CARD} p-4`}>
          <header className="mb-3 flex items-baseline justify-between gap-2 text-sm text-muted">
            <span>Comanda de {tabName.get(order.tabId)}</span>
            {/* Hora formatada só no navegador: o componente é cliente e carrega depois da hidratação. */}
            <time dateTime={order.createdAt}>{timeFormat.format(new Date(order.createdAt))}</time>
          </header>
          <ul className="flex flex-col gap-3">
            {view.items
              .filter((item) => item.orderId === order.id)
              .map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {item.quantity}× {item.nameSnapshot}
                    </p>
                    {item.note && <p className="text-sm text-muted">{item.note}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <ItemStatusBadge status={item.status} />
                    {checkItemTransition(item.status, "canceled", "customer").ok && (
                      <button
                        type="button"
                        className="text-sm font-semibold text-danger underline-offset-2 hover:underline disabled:opacity-50"
                        disabled={busyItemId === item.id}
                        onClick={() => onCancel(item.id)}
                        aria-label={`Cancelar ${item.nameSnapshot}`}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </article>
      ))}
    </section>
  );
};
