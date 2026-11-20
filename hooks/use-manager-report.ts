"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/use-restaurant";
import type { DayReport } from "@/lib/metrics";
import type { PeriodRange } from "@/lib/periods";
import type { ItemRow, TabRow } from "@/lib/report-rows";

export type ReportData = { report: DayReport; rows: { items: ItemRow[]; tabs: TabRow[] } };

/**
 * Números do período para o gerente. Relê quando o período muda e quando `lastSeq` muda
 * (o polling da tela já avisa de pedidos novos). Sem período, não busca.
 */
export const useManagerReport = (range: PeriodRange | null, lastSeq: number) => {
  const apiRequest = useApi();
  const [data, setData] = useState<{ key: string; value: ReportData } | null>(null);
  const [message, setMessage] = useState("");
  const key = range ? `${range.since}|${range.until}` : "";

  useEffect(() => {
    if (!range) return;
    let active = true;
    const query = `since=${encodeURIComponent(range.since)}&until=${encodeURIComponent(range.until)}`;
    void apiRequest<ReportData>(`/api/staff/report?role=manager&${query}`).then((response) => {
      if (!active) return;
      if (response.ok) {
        setData({ key: `${range.since}|${range.until}`, value: response.data });
        setMessage("");
      } else {
        setMessage(response.message);
      }
    });
    return () => {
      active = false;
    };
  }, [apiRequest, range, lastSeq]);

  // Enquanto o período novo carrega, não mostra os números do período anterior.
  return { data: data && data.key === key ? data.value : null, message };
};
