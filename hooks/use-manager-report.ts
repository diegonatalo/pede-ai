"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/use-restaurant";
import { startOfLocalDay, type DayReport } from "@/lib/metrics";

/**
 * Números do dia para o gerente. Relê sempre que `lastSeq` muda (o polling da tela já avisa).
 * O início do dia é calculado no navegador, no fuso de quem está olhando.
 */
export const useManagerReport = (enabled: boolean, lastSeq: number) => {
  const apiRequest = useApi();
  const [report, setReport] = useState<DayReport | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const since = encodeURIComponent(startOfLocalDay(new Date()));
    void apiRequest<{ report: DayReport }>(`/api/staff/report?role=manager&since=${since}`).then((response) => {
      if (!active) return;
      if (response.ok) {
        setReport(response.data.report);
        setMessage("");
      } else {
        setMessage(response.message);
      }
    });
    return () => {
      active = false;
    };
  }, [apiRequest, enabled, lastSeq]);

  return { report, message };
};
