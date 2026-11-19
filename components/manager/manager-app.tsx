"use client";

import { useState } from "react";
import { MenuEditor } from "@/components/manager/menu-editor";
import { QrSheet } from "@/components/manager/qr-sheet";
import { ReportPanel } from "@/components/manager/report-panel";
import { SettingsForm } from "@/components/manager/settings-form";
import { TeamPanel } from "@/components/manager/team-panel";
import { StaffHeader } from "@/components/staff/staff-header";
import { StaffLogin } from "@/components/staff/staff-login";
import { BUTTON, CARD } from "@/components/ui/styles";
import { TablesPanel } from "@/components/waiter/tables-panel";
import { useManagerReport } from "@/hooks/use-manager-report";
import { useStaffCommand } from "@/hooks/use-staff-command";
import { useStaffOverview } from "@/hooks/use-staff-overview";
import { cn } from "@/lib/cn";
import { tableBoard } from "@/lib/selectors";

type Section = "floor" | "report" | "menu" | "team" | "settings";

// Até 5 seções (barra de abas no celular): os QR codes ficam nos ajustes, com a configuração do salão.
const SECTIONS: [Section, string][] = [
  ["floor", "Salão"],
  ["report", "Números"],
  ["menu", "Cardápio"],
  ["team", "Equipe"],
  ["settings", "Ajustes"],
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
      <nav
        aria-label="Seções"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:static md:border-t-0 md:border-b print:hidden"
      >
        <ul className="mx-auto grid max-w-6xl grid-cols-5 md:flex md:gap-2 md:px-4">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <button
                type="button"
                aria-current={section === id ? "page" : undefined}
                onClick={() => {
                  setSection(id);
                  window.scrollTo({ top: 0 });
                }}
                className={cn(
                  "flex min-h-16 w-full items-center justify-center font-semibold md:min-h-12 md:px-4",
                  section === id ? "text-accent" : "text-muted",
                )}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
        {message && (
          <p className="mb-4 rounded-xl bg-red-100 p-3 text-sm font-medium text-red-900 dark:bg-red-900/40 dark:text-red-100" role="alert">
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
          <div className="flex flex-col gap-8">
            <div className="print:hidden">
              <SettingsForm
                // Recria o formulário só quando a configuração muda (não a cada pedido, o que apagaria o que está sendo digitado).
                key={`${data.restaurant.serviceFeePercent}-${data.restaurant.couvertCents}-${data.restaurant.requireFirstOrderApproval}`}
                restaurant={data.restaurant}
                onSaved={refresh}
              />
            </div>
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
