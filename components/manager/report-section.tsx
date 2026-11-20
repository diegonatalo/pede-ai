"use client";

import { useMemo, useState } from "react";
import { ReportPanel } from "@/components/manager/report-panel";
import { BUTTON, INPUT, LABEL } from "@/components/ui/styles";
import { useManagerReport } from "@/hooks/use-manager-report";
import { useToday } from "@/hooks/use-today";
import { cn } from "@/lib/cn";
import { itemsCsv, tabsCsv } from "@/lib/csv";
import { parseLocalDate, PERIOD_LABEL, periodRange, toDateInput, type PeriodPreset } from "@/lib/periods";

const PRESETS: PeriodPreset[] = ["today", "yesterday", "last7", "month", "custom"];

/** Baixa um texto como arquivo (o CSV é montado no aparelho, no fuso de quem baixa). */
const download = (name: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** Números do gerente: escolher o período, ver o resumo e baixar as planilhas. */
export const ReportSection = ({ lastSeq }: { lastSeq: number }) => {
  const today = useToday();
  const [preset, setPreset] = useState<PeriodPreset>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // O período depende da data do aparelho: só existe depois da hidratação.
  const range = useMemo(() => {
    // `today` é "AAAA-MM-DD" local; lido como data local, não UTC.
    const now = today ? parseLocalDate(today) : null;
    if (!now) return null;
    return periodRange(preset, now, { from: from || today, to: to || today });
  }, [today, preset, from, to]);
  const { data, message } = useManagerReport(range, lastSeq);

  const fileName = (kind: string) => {
    const start = range ? toDateInput(new Date(range.since)) : today;
    const end = range ? toDateInput(new Date(Date.parse(range.until) - 1)) : start;
    return `pede-ai-${kind}-${start === end ? start : `${start}-a-${end}`}.csv`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
          {PRESETS.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={preset === entry}
              className={preset === entry ? BUTTON.smallPrimary : BUTTON.small}
              onClick={() => setPreset(entry)}
            >
              {PERIOD_LABEL[entry]}
            </button>
          ))}
        </div>
        {preset === "custom" && today && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>De</span>
              <input
                type="date"
                className={cn(INPUT, "w-auto")}
                value={from || today}
                max={today}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Até</span>
              <input
                type="date"
                className={cn(INPUT, "w-auto")}
                value={to || today}
                max={today}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
        )}
        {preset === "custom" && today && !range && (
          <p className="text-sm font-medium text-danger" role="alert">
            Escolha um período válido: a data inicial antes da final, em até um ano.
          </p>
        )}
      </div>

      {!range ? null : data ? (
        <>
          <ReportPanel report={data.report} periodLabel={range.label} />
          <section aria-labelledby="titulo-planilhas" className="flex flex-col gap-3">
            <h2 id="titulo-planilhas" className="text-lg font-bold">
              Planilhas
            </h2>
            <p className="text-sm text-muted">
              Para abrir no Excel ou no Google Planilhas. Uma linha por item pedido, ou uma por comanda com taxa, couvert e
              total.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={BUTTON.secondary}
                disabled={data.rows.items.length === 0}
                onClick={() => download(fileName("itens"), itemsCsv(data.rows.items))}
              >
                Baixar itens (CSV)
              </button>
              <button
                type="button"
                className={BUTTON.secondary}
                disabled={data.rows.tabs.length === 0}
                onClick={() => download(fileName("comandas"), tabsCsv(data.rows.tabs))}
              >
                Baixar comandas (CSV)
              </button>
            </div>
          </section>
        </>
      ) : (
        <p className="text-muted" role="status">
          {message || "Carregando os números…"}
        </p>
      )}
    </div>
  );
};
