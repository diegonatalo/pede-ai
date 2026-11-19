"use client";

import { useState } from "react";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffLogin } from "@/components/staff/staff-login";
import { CenteredScreen } from "@/components/ui/centered-screen";
import { BUTTON, CARD } from "@/components/ui/styles";
import { NowPanel } from "@/components/waiter/now-panel";
import { TablesPanel } from "@/components/waiter/tables-panel";
import { useAttentionAlert } from "@/hooks/use-attention-alert";
import { useStaffCommand } from "@/hooks/use-staff-command";
import { useStaffOverview } from "@/hooks/use-staff-overview";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { tableBoard, waiterAttention } from "@/lib/selectors";
import { TabBar } from "@/components/ui/tab-bar";
import { ClockIcon, TablesIcon } from "@/components/ui/icons";

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
  const board = tableBoard(data.tables, data.sessions, data.restaurant, data.joinCodes);
  const busyTables = board.filter((entry) => entry.session).length;

  return (
    <div className="flex flex-1 flex-col pb-20 md:pb-0">
      <StaffHeader
        role="waiter"
        restaurantName={data.restaurant.name}
        personName={data.me?.name}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        onLoggedOut={() => void refresh()}
      />

      <div className="mx-auto w-full max-w-5xl md:px-4 md:pt-3">
        <TabBar
          layout="responsive"
          current={section}
          onSelect={(id) => {
            setSection(id);
            window.scrollTo({ top: 0 });
          }}
          items={[
            { id: "now", label: "Agora", icon: ClockIcon, badge: attention, urgent: true },
            { id: "tables", label: "Mesas", icon: TablesIcon, badge: busyTables },
          ]}
        />
      </div>

      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        {message && (
          <p className="mb-4 rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger" role="alert">
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
