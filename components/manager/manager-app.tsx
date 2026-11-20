"use client";

import { useState } from "react";
import { MapEditor } from "@/components/manager/map-editor";
import { MenuEditor } from "@/components/manager/menu-editor";
import { QrSheet } from "@/components/manager/qr-sheet";
import { ReportPanel } from "@/components/manager/report-panel";
import { SettingsForm } from "@/components/manager/settings-form";
import { TablesEditor } from "@/components/manager/tables-editor";
import { TeamPanel } from "@/components/manager/team-panel";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffLogin } from "@/components/staff/staff-login";
import { CenteredScreen } from "@/components/ui/centered-screen";
import { BUTTON, CARD } from "@/components/ui/styles";
import { TablesPanel } from "@/components/waiter/tables-panel";
import { useManagerReport } from "@/hooks/use-manager-report";
import { useStaffCommand } from "@/hooks/use-staff-command";
import { useStaffOverview } from "@/hooks/use-staff-overview";
import { tableBoard } from "@/lib/selectors";
import { TabBar, type TabItem } from "@/components/ui/tab-bar";
import { ChartIcon, SlidersIcon, TablesIcon, UsersIcon, UtensilsIcon } from "@/components/ui/icons";

type Section = "floor" | "report" | "menu" | "team" | "settings";

// Até 5 seções (barra de abas no celular): os QR codes ficam nos ajustes, com a configuração do salão.
const SECTIONS: [Section, string, TabItem<Section>["icon"]][] = [
  ["floor", "Salão", TablesIcon],
  ["report", "Números", ChartIcon],
  ["menu", "Cardápio", UtensilsIcon],
  ["team", "Equipe", UsersIcon],
  ["settings", "Ajustes", SlidersIcon],
];

export const ManagerApp = () => {
  const { state, refresh } = useStaffOverview("manager");
  const [section, setSection] = useState<Section>("floor");
  const { busy, message, run } = useStaffCommand("manager", refresh);
  const ready = state.status === "ready";
  const { report, message: reportMessage } = useManagerReport(ready, ready ? state.data.lastSeq : 0);

  if (state.status === "loading") {
    return (
      <p className="py-20 text-center text-muted" role="status">
        Carregando…
      </p>
    );
  }

  if (state.status === "login") return <StaffLogin role="manager" onLoggedIn={() => void refresh()} />;

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
  const occupied = board.filter((entry) => entry.session).length;
  const billRequested = board.filter((entry) => entry.billRequested).length;

  return (
    <div className="flex flex-1 flex-col pb-20 md:pb-0">
      <StaffHeader
        role="manager"
        restaurantName={data.restaurant.name}
        personName={data.me?.name}
        onLoggedOut={() => void refresh()}
      />
      <div className="mx-auto w-full max-w-6xl md:px-4 md:pt-3">
        <TabBar
          layout="responsive"
          current={section}
          onSelect={(id) => {
            setSection(id);
            window.scrollTo({ top: 0 });
          }}
          items={SECTIONS.map(([id, label, icon]) => ({ id, label, icon }))}
        />
      </div>

      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
        {message && (
          <p className="mb-4 rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger" role="alert">
            {message}
          </p>
        )}
        {section === "floor" && (
          <div className="flex flex-col gap-4">
            <p className="text-muted" role="status">
              {occupied} de {board.length} mesas ocupadas
              {billRequested > 0 && ` · ${billRequested} pedindo a conta`}
            </p>
            <TablesPanel board={board} busy={busy} run={(key, path, body) => void run(key, path, body)} />
          </div>
        )}
        {section === "report" &&
          (report ? (
            <ReportPanel report={report} />
          ) : (
            <p className="text-muted" role="status">
              {reportMessage || "Carregando os números…"}
            </p>
          ))}
        {section === "menu" && <MenuEditor menu={data.menu} busy={busy} run={run} />}
        {section === "team" && <TeamPanel meId={data.me?.staffId} />}
        {section === "settings" && (
          <div className="flex flex-col gap-10">
            <section aria-labelledby="titulo-mesas" className="flex flex-col gap-4 print:hidden">
              <h2 id="titulo-mesas" className="text-xl font-bold">
                Mesas
              </h2>
              <TablesEditor
                tables={data.tables}
                openTableIds={new Set(data.sessions.map((entry) => entry.session.tableId))}
                busy={busy}
                run={run}
              />
            </section>
            <section aria-labelledby="titulo-mapa" className="flex flex-col gap-4 print:hidden">
              <div>
                <h2 id="titulo-mapa" className="text-xl font-bold">
                  Mapa do salão
                </h2>
                <p className="text-sm text-muted">
                  Opcional. Ajuda o cliente a achar a mesa, o banheiro e o caixa. Em cima fica o fundo; embaixo, a entrada.
                </p>
              </div>
              <MapEditor
                // Recomeça do que está salvo quando o mapa ou as mesas mudam no servidor.
                key={JSON.stringify([data.mapSpots, data.tables.map((table) => table.id)])}
                tables={data.tables}
                spots={data.mapSpots}
                busy={busy === "mapa"}
                run={run}
              />
            </section>
            <section aria-labelledby="titulo-ajustes" className="flex flex-col gap-4 print:hidden">
              <h2 id="titulo-ajustes" className="text-xl font-bold">
                Restaurante, taxa e couvert
              </h2>
              <SettingsForm
                // Recria o formulário só quando a configuração muda (não a cada pedido, o que apagaria o que está sendo digitado).
                key={`${data.restaurant.name}-${data.restaurant.serviceFeePercent}-${data.restaurant.couvertCents}-${data.restaurant.requireFirstOrderApproval}`}
                restaurant={data.restaurant}
                onSaved={refresh}
              />
            </section>
            <section aria-labelledby="titulo-qr" className="flex flex-col gap-4">
              <h2 id="titulo-qr" className="text-xl font-bold print:hidden">
                QR codes das mesas
              </h2>
              <QrSheet tables={data.tables} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
