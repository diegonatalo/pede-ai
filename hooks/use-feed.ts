"use client";

import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api-client";

export const FEED_INTERVAL_MS = 3000;

/**
 * Consulta o feed a cada poucos segundos e chama `onChange` quando algo mudou depois de `lastSeq`.
 * Pausa com a aba escondida (economiza bateria e invocações) e consulta na hora ao voltar.
 * `url` nulo desliga o polling.
 */
export const useFeed = (
  url: string | null,
  lastSeq: number,
  onChange: () => void,
  intervalMs = FEED_INTERVAL_MS,
) => {
  const seq = useRef(lastSeq);
  const handler = useRef(onChange);

  useEffect(() => {
    seq.current = lastSeq;
    handler.current = onChange;
  });

  useEffect(() => {
    if (!url) return;
    let timer: number | undefined;
    let stopped = false;

    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      const separator = url.includes("?") ? "&" : "?";
      const response = await apiRequest<{ lastSeq: number; changed: boolean }>(
        `${url}${separator}after=${seq.current}`,
      );
      if (stopped) return;
      // 401/409 também acordam a tela: ela descobre que perdeu o acesso ou que a mesa fechou.
      if ((response.ok && response.data.changed) || (!response.ok && response.status >= 400)) {
        handler.current();
      }
    };

    const schedule = () => {
      timer = window.setTimeout(async () => {
        await poll();
        if (!stopped) schedule();
      }, intervalMs);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, intervalMs]);
};
