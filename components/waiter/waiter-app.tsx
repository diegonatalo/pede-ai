"use client";

import { useState } from "react";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffLogin } from "@/components/staff/staff-login";
import { BUTTON, CARD } from "@/components/ui/styles";
import { NowPanel } from "@/components/waiter/now-panel";
import { TablesPanel } from "@/components/waiter/tables-panel";
import { useAttentionAlert } from "@/hooks/use-attention-alert";
import { useStaffCommand } from "@/hooks/use-staff-command";
import { useStaffOverview } from "@/hooks/use-staff-overview";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { cn } from "@/lib/cn";
import { tableBoard, waiterAttention } from "@/lib/selectors";

type Section = "now" | "tables";

export const WaiterApp = () => {
  const { state, refresh } = useStaffOverview("waiter");
  const [section, setSection] = useState<Section>("now");
  const { busy, message, run } = useStaffCommand("waiter", refresh);

  const sessions = state.status === "ready" ? state.data.sessions : [];
  const attention = waiterAttention(sessions);
  const { soundOn, toggleSound } = useAttentionAlert(attention);
  useWakeLock(state.status === "ready");

  if (state.status === "loading") {
    return (
      <p className="py-20 text-center text-muted" role="status">
        Carregando…
      </p>
    );
  }

  if (state.status === "login") return <StaffLogin role="waiter" onLoggedIn={() => void refresh()} />;

  if (state.status === "error") {
    return (
      <main id="conteudo" className="mx-auto w-full max-w-md px-4 py-20">
        <section className={`${CARD} p-6 text-center`}>
          <h1 className="text-2xl font-bold">Não deu para carregar</h1>
          <p className="mt-2 text-muted">{state.message}</p>
          <button type="button" className={`${BUTTON.primary} mt-6`} onClick={() => void refresh()}>
            Tentar de novo
          </button>
        </section>
      </main>
    );
  }

  const { data } = state;
  const board = tableBoard(data.tables, data.sessions, data.restaurant, data.joinCodes);
  const busyTables = board.filter((entry) => entry.session).length;

  return (
    <div className="flex flex-1 flex-col pb-20 md:pb-0">
      <StaffHeader
        role="waiter"
        restaurantName={data.restaurant.name}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        onLoggedOut={() => void refresh()}
      />

      <nav
        aria-label="Seções"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:static md:border-t-0 md:border-b"
      >
        <ul className="mx-auto grid max-w-5xl grid-cols-2 md:flex md:gap-2 md:px-4">
          {(
            [
              ["now", "Agora", attention],
              ["tables", "Mesas", busyTables],
            ] as const
          ).map(([id, label, count]) => (
            <li key={id}>
              <button
                type="button"
                aria-current={section === id ? "page" : undefined}
                onClick={() => {
                  setSection(id);
                  window.scrollTo({ top: 0 });
                }}
                className={cn(
                  "flex min-h-16 w-full items-center justify-center gap-2 font-semibold md:min-h-12 md:px-4",
                  section === id ? "text-accent" : "text-muted",
                )}
              >
                {label}
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 text-sm",
                      id === "now" ? "bg-accent text-on-accent" : "bg-border text-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        {message && (
          <p className="mb-4 rounded-xl bg-red-100 p-3 text-sm font-medium text-red-900 dark:bg-red-900/40 dark:text-red-100" role="alert">
            {message}
          </p>
        )}
        {section === "now" ? (
          <NowPanel sessions={data.sessions} busy={busy} run={(key, path, body) => void run(key, path, body)} />
        ) : (
          <TablesPanel board={board} busy={busy} run={(key, path, body) => void run(key, path, body)} />
        )}
      </main>
    </div>
  );
};
