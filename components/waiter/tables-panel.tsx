"use client";

import { BUTTON, CARD } from "@/components/ui/styles";
import { TAB_STATUS_LABEL } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import type { TableSummary } from "@/lib/selectors";
import { cn } from "@/lib/cn";

type Props = {
  board: TableSummary[];
  busy: string | null;
  run: (key: string, path: string, body?: unknown) => void;
};

/** Salão: abrir mesa e passar o código, ver as comandas com o total, receber e fechar. */
export const TablesPanel = ({ board, busy, run }: Props) => (
  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {board.map((summary) => {
      const { table, session, joinCode } = summary;
      return (
        <li
          key={table.id}
          className={cn(
            CARD,
            "flex flex-col gap-3 p-4",
            summary.billRequested && "border-info",
            summary.needsApproval && "border-warning",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold">{table.label}</h3>
              <p className="text-sm text-muted">
                {table.seats} lugares · {session ? "Ocupada" : "Livre"}
                {summary.billRequested && " · pediram a conta"}
              </p>
            </div>
            {joinCode && (
              <p className="text-right">
                <span className="block text-xs text-muted">Código</span>
                <span className="font-mono text-2xl font-bold tracking-widest" aria-label={`Código da ${table.label}: ${joinCode.split("").join(" ")}`}>
                  {joinCode}
                </span>
              </p>
            )}
          </div>

          {!session ? (
            <button
              type="button"
              className={BUTTON.secondary}
              disabled={busy === table.id}
              onClick={() => run(table.id, "/api/staff/sessions", { tableId: table.id })}
              aria-label={`Abrir a ${table.label}`}
            >
              Abrir mesa
            </button>
          ) : (
            <>
              {session.tabs.length === 0 ? (
                <p className="text-sm text-muted">Ninguém entrou ainda. Passe o código para a mesa.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {session.tabs.map((tab) => {
                    const bill = summary.bills.find((entry) => entry.tabId === tab.id);
                    const payable = tab.status === "open" || tab.status === "bill_requested";
                    return (
                      <li key={tab.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                        <div>
                          <p className="font-semibold">{tab.customerName}</p>
                          <p className="text-sm text-muted">
                            {TAB_STATUS_LABEL[tab.status]}
                            {bill && tab.status !== "canceled" && ` · ${formatCents(bill.totalCents)}`}
                            {bill && bill.pendingCount > 0 && ` · ${bill.pendingCount} a entregar`}
                          </p>
                        </div>
                        {payable && (
                          <button
                            type="button"
                            className={BUTTON.small}
                            disabled={busy === tab.id}
                            onClick={() => run(tab.id, `/api/staff/tabs/${tab.id}/status`, { to: "paid" })}
                            aria-label={`Marcar a comanda de ${tab.customerName} (${table.label}) como paga`}
                          >
                            Marcar paga
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm text-muted">Total da mesa</span>
                <span className="font-bold">{formatCents(summary.totalCents)}</span>
              </div>
              {summary.canClose && (
                <button
                  type="button"
                  className={BUTTON.primary}
                  disabled={busy === session.session.id}
                  onClick={() => run(session.session.id, `/api/staff/sessions/${session.session.id}/close`)}
                  aria-label={`Fechar a ${table.label}`}
                >
                  Fechar mesa
                </button>
              )}
            </>
          )}
        </li>
      );
    })}
  </ul>
);
