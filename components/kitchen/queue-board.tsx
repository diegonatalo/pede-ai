"use client";

import { BUTTON, CARD } from "@/components/ui/styles";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/cn";
import { STATION_LABEL } from "@/lib/labels";
import { minutesSince, type KitchenQueue, type KitchenTicket } from "@/lib/selectors";

type Props = {
  queue: KitchenQueue;
  showStation: boolean;
  busy: string | null;
  run: (key: string, path: string, body?: unknown) => void;
};

const COLUMNS = [
  { id: "sent", title: "Novos", empty: "Nenhum pedido novo." },
  { id: "preparing", title: "Em preparo", empty: "Nada no fogo." },
  { id: "ready", title: "Prontos", empty: "Nada esperando o garçom." },
] as const;

const Waited = ({ since, alertAfter }: { since: string; alertAfter: number }) => {
  const now = useNow();
  if (!now) return null;
  const minutes = minutesSince(since, now);
  return (
    <span className={cn("text-sm whitespace-nowrap", minutes >= alertAfter ? "font-bold text-red-700 dark:text-red-400" : "text-muted")}>
      {minutes === 0 ? "agora" : `${minutes} min`}
    </span>
  );
};

const Ticket = ({ ticket, column, showStation, busy, run }: { ticket: KitchenTicket; column: (typeof COLUMNS)[number]["id"] } & Omit<Props, "queue">) => {
  const { item, table, tabName } = ticket;
  const status = (to: string) => () => run(item.id, `/api/staff/items/${item.id}/status`, { to });
  const disabled = busy === item.id;
  return (
    <li className={cn(CARD, "flex flex-col gap-3 p-4", column === "ready" && "border-emerald-500")}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          {table.label} · {tabName}
          {showStation && <span className="text-muted"> · {STATION_LABEL[item.station]}</span>}
        </p>
        <Waited since={item.updatedAt} alertAfter={column === "ready" ? 5 : 15} />
      </div>
      <h3 className="text-xl leading-tight font-bold">
        {item.quantity}× {item.nameSnapshot}
      </h3>
      {item.note && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 font-semibold text-amber-950 dark:bg-amber-900/50 dark:text-amber-50">
          {item.note}
        </p>
      )}
      {column === "sent" && (
        <button type="button" className={BUTTON.primary} disabled={disabled} onClick={status("preparing")} aria-label={`Começar ${item.nameSnapshot} da ${table.label}`}>
          Começar
        </button>
      )}
      {column === "preparing" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cn(BUTTON.primary, "flex-1")} disabled={disabled} onClick={status("ready")} aria-label={`${item.nameSnapshot} da ${table.label} está pronto`}>
            Pronto
          </button>
          <button type="button" className={cn(BUTTON.ghost, "text-sm")} disabled={disabled} onClick={status("sent")} aria-label={`Devolver ${item.nameSnapshot} da ${table.label} para a fila`}>
            Voltar para a fila
          </button>
        </div>
      )}
      {column === "ready" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">Esperando o garçom</p>
          <button type="button" className={cn(BUTTON.ghost, "text-sm")} disabled={disabled} onClick={status("preparing")} aria-label={`${item.nameSnapshot} da ${table.label} ainda não está pronto`}>
            Não estava pronto
          </button>
        </div>
      )}
    </li>
  );
};

/** Três colunas, lado a lado no tablet e uma embaixo da outra no celular. */
export const QueueBoard = ({ queue, showStation, busy, run }: Props) => (
  <div className="grid gap-6 md:grid-cols-3">
    {COLUMNS.map((column) => (
      <section key={column.id} aria-labelledby={`coluna-${column.id}`} className="flex flex-col gap-3">
        <h2 id={`coluna-${column.id}`} className="flex items-center gap-2 text-lg font-bold">
          {column.title}
          <span className="rounded-full bg-border px-2 text-sm">{queue[column.id].length}</span>
        </h2>
        {queue[column.id].length === 0 ? (
          <p className="text-sm text-muted">{column.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue[column.id].map((ticket) => (
              <Ticket key={ticket.item.id} ticket={ticket} column={column.id} showStation={showStation} busy={busy} run={run} />
            ))}
          </ul>
        )}
      </section>
    ))}
  </div>
);
