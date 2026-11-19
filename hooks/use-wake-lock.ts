"use client";

import { useEffect } from "react";

/**
 * Mantém a tela acesa enquanto `enabled` (tablet da cozinha, celular do garçom).
 * O navegador solta o bloqueio quando a aba fica escondida; ele é pedido de novo ao voltar.
 * Navegadores sem a Wake Lock API seguem normalmente.
 */
export const useWakeLock = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;

    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (stopped) void sentinel.release();
      } catch {
        // Sem permissão ou bateria fraca: a tela só apaga como de costume.
      }
    };

    const onVisible = () => void request();
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, [enabled]);
};
