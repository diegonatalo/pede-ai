"use client";

import { BUTTON, CARD } from "@/components/ui/styles";
import { useNow } from "@/hooks/use-now";
import { CALL_REASON_LABEL, STATION_LABEL } from "@/lib/labels";
import { activeCalls, minutesSince, pendingApprovals, pickupQueue } from "@/lib/selectors";
import type { SessionSnapshot } from "@/types/store";

type Props = {
  sessions: SessionSnapshot[];
  busy: string | null;
  run: (key: string, path: string, body?: unknown) => void;
};

const Waited = ({ since }: { since: string }) => {
  const now = useNow();
  if (!now) return null;
  const minutes = minutesSince(since, now);
  return (
    <span className={minutes >= 10 ? "whitespace-nowrap font-semibold text-red-700 dark:text-red-400" : "whitespace-nowrap text-muted"}>
      {minutes === 0 ? "agora" : `há ${minutes} min`}
    </span>
  );
};

const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
  <section aria-labelledby={`secao-${title}`} className="flex flex-col gap-3">
    <h2 id={`secao-${title}`} className="flex items-center gap-2 text-lg font-bold">
      {title}
      <span className="rounded-full bg-border px-2 text-sm">{count}</span>
    </h2>
    {count === 0 ? <p className="text-sm text-muted">Nada por aqui.</p> : children}
  </section>
);

/** O que o garçom precisa fazer agora: confirmar pedidos, levar itens e atender chamados. */
export const NowPanel = ({ sessions, busy, run }: Props) => {
  const approvals = pendingApprovals(sessions);
  const pickups = pickupQueue(sessions);
  const calls = activeCalls(sessions);

  return (
    <div className="flex flex-col gap-8">
      <Section title="Confirmar pedidos" count={approvals.length}>
        <ul className="grid gap-3 md:grid-cols-2">
          {approvals.map(({ session, tab, items }) => (
            <li key={tab.id} className={`${CARD} flex flex-col gap-3 border-amber-400 p-4`}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-bold">
                  {session.table.label} · {tab.customerName}
                </h3>
                <Waited since={items[0].updatedAt} />
              </div>
              <p className="text-sm text-muted">
                Primeiro pedido desta comanda. Confira se a pessoa está mesmo na mesa.
              </p>
              <ul className="text-sm">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.nameSnapshot}
                    {item.note && <span className="text-muted"> ({item.note})</span>}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={BUTTON.primary}
                disabled={busy === tab.id}
                onClick={() => run(tab.id, `/api/staff/tabs/${tab.id}/approve`)}
              >
                Confirmar comanda de {tab.customerName}
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Para retirar" count={pickups.length}>
        <ul className="grid gap-3 md:grid-cols-2">
          {pickups.map(({ table, tabName, item }) => {
            const ready = item.status === "ready";
            return (
              <li key={item.id} className={`${CARD} flex flex-col gap-3 p-4 ${ready ? "border-emerald-500" : ""}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-bold">
                    {item.quantity}× {item.nameSnapshot}
                  </h3>
                  <Waited since={item.updatedAt} />
                </div>
                <p className="text-sm">
                  {table.label} · {tabName} ·{" "}
                  <span className="text-muted">{ready ? `Pronto no balcão (${STATION_LABEL[item.station]})` : "Com você"}</span>
                </p>
                <button
                  type="button"
                  className={ready ? BUTTON.primary : BUTTON.secondary}
                  disabled={busy === item.id}
                  onClick={() =>
                    run(item.id, `/api/staff/items/${item.id}/status`, { to: ready ? "picked_up" : "delivered" })
                  }
                  aria-label={`${ready ? "Retirei" : "Entreguei"} ${item.nameSnapshot} da ${table.label}`}
                >
                  {ready ? "Retirei" : "Entreguei na mesa"}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Chamados" count={calls.length}>
        <ul className="grid gap-3 md:grid-cols-2">
          {calls.map(({ table, tabName, call }) => {
            const open = call.status === "open";
            return (
              <li key={call.id} className={`${CARD} flex flex-col gap-3 p-4 ${open ? "border-sky-500" : ""}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-bold">
                    {table.label}
                    {tabName && ` · ${tabName}`}
                  </h3>
                  <Waited since={call.createdAt} />
                </div>
                <p className="text-sm">
                  {CALL_REASON_LABEL[call.reason]}
                  {call.message && <span className="text-muted">: “{call.message}”</span>}
                </p>
                <button
                  type="button"
                  className={open ? BUTTON.primary : BUTTON.secondary}
                  disabled={busy === call.id}
                  onClick={() =>
                    run(call.id, `/api/staff/calls/${call.id}/status`, { to: open ? "acknowledged" : "resolved" })
                  }
                  aria-label={`${open ? "Estou indo" : "Resolvido"}: ${table.label}`}
                >
                  {open ? "Estou indo" : "Resolvido"}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
};
