"use client";

import { useState } from "react";
import { AvailabilityList } from "@/components/kitchen/availability-list";
import { QueueBoard } from "@/components/kitchen/queue-board";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffLogin } from "@/components/staff/staff-login";
import { CenteredScreen } from "@/components/ui/centered-screen";
import { BUTTON, CARD } from "@/components/ui/styles";
import { useAttentionAlert } from "@/hooks/use-attention-alert";
import { useStaffCommand } from "@/hooks/use-staff-command";
import { useStaffOverview } from "@/hooks/use-staff-overview";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { cn } from "@/lib/cn";
import { kitchenQueue, type StationFilter } from "@/lib/selectors";
import { TabBar } from "@/components/ui/tab-bar";
import { FlameIcon, ListIcon } from "@/components/ui/icons";

type Section = "queue" | "menu";

const STATIONS: [StationFilter, string][] = [
  ["all", "Tudo"],
  ["kitchen", "Cozinha"],
  ["bar", "Bar"],
];

export const KitchenApp = () => {
  const { state, refresh } = useStaffOverview("kitchen");
  const [section, setSection] = useState<Section>("queue");
  const [station, setStation] = useState<StationFilter>("all");
  const { busy, message, run } = useStaffCommand("kitchen", refresh);

  const queue = kitchenQueue(state.status === "ready" ? state.data.sessions : [], station);
  // Bipe quando chega pedido novo na estação escolhida.
  const { soundOn, toggleSound } = useAttentionAlert(queue.sent.length);
  useWakeLock(state.status === "ready");

  if (state.status === "loading") {
    return (
      <p className="py-20 text-center text-muted" role="status">
        Carregando…
      </p>
    );
  }

  if (state.status === "login") return <StaffLogin role="kitchen" onLoggedIn={() => void refresh()} />;

  if (state.status === "error") {
    return (
      <CenteredScreen wide>
        <section className={`${CARD} p-6 text-center`}>
          <h1 className="text-2xl font-bold">Não deu para carregar</h1>
          <p className="mt-2 text-muted">{state.message}</p>
          <button type="button" className={`${BUTTON.primary} mt-6`} onClick={() => void refresh()}>
            Tentar de novo
          </button>
        </section>
      </CenteredScreen>
    );
  }

  const { data } = state;
  const handleRun = (key: string, path: string, body?: unknown) => void run(key, path, body);

  return (
    <div className="flex flex-1 flex-col pb-20 md:pb-0">
      <StaffHeader
        role="kitchen"
        restaurantName={data.restaurant.name}
        personName={data.me?.name}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        onLoggedOut={() => void refresh()}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div role="group" aria-label="Estação" className="inline-flex rounded-full border border-border bg-card p-1">
          {STATIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={station === id}
              onClick={() => setStation(id)}
              className={cn(
                "min-h-10 rounded-full px-4 text-sm font-semibold",
                station === id ? "bg-accent text-on-accent" : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <TabBar
          layout="responsive"
          current={section}
          onSelect={setSection}
          items={[
            { id: "queue", label: "Fila", icon: FlameIcon, badge: queue.sent.length, urgent: true },
            {
              id: "menu",
              label: "Cardápio",
              icon: ListIcon,
              badge: data.menu.items.filter((item) => !item.available).length,
            },
          ]}
        />
      </div>

      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
        {message && (
          <p className="mb-4 rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger" role="alert">
            {message}
          </p>
        )}
        {section === "queue" ? (
          <QueueBoard queue={queue} showStation={station === "all"} busy={busy} run={handleRun} />
        ) : (
          <AvailabilityList menu={data.menu} station={station} busy={busy} run={handleRun} />
        )}
      </main>
    </div>
  );
};
