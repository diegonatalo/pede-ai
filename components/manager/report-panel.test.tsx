import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportPanel } from "@/components/manager/report-panel";
import type { DayReport } from "@/lib/metrics";

const report: DayReport = {
  revenueCents: 11330,
  paidTabs: 2,
  peopleServed: 3,
  averagePerPersonCents: 3777,
  openTables: 1,
  closedTables: 4,
  itemsSold: 5,
  canceledItems: 1,
  averagePrepMinutes: 12.5,
  averageServeMinutes: null,
  topItems: [
    { name: "Chope", quantity: 3 },
    { name: "Risoto", quantity: 1 },
  ],
};

const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent?.replace(/\s/g, " ");

describe("ReportPanel", () => {
  it("mostra os números do período formatados", () => {
    render(<ReportPanel report={report} periodLabel="Últimos 7 dias" />);
    expect(screen.getByRole("heading", { name: "Últimos 7 dias" })).toBeInTheDocument();
    expect(valueOf("Faturamento")).toBe("R$ 113,30");
    expect(valueOf("Média por pessoa")).toBe("R$ 37,77");
    expect(valueOf("Tempo de preparo")).toBe("12,5 min");
    expect(valueOf("Tempo até a mesa")).toBe("—");
    expect(valueOf("Mesas atendidas")).toBe("5");
    expect(screen.getByText("1 ainda abertas")).toBeInTheDocument();
  });

  it("lista os mais pedidos em ordem", () => {
    render(<ReportPanel report={report} />);
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["1.Chope3", "2.Risoto1"]);
  });

  it("avisa quando ainda não vendeu nada", () => {
    render(<ReportPanel report={{ ...report, topItems: [] }} />);
    expect(screen.getByText("Nenhum item vendido neste período.")).toBeInTheDocument();
  });
});
