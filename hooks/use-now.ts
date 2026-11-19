"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

let current = 0;
const listeners = new Set<() => void>();
let timer: number | undefined;

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  if (timer === undefined) {
    current = Date.now();
    timer = window.setInterval(() => {
      current = Date.now();
      for (const listener of listeners) listener();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
};

/**
 * Hora atual em ms, atualizada a cada 30 s, para "há 5 min". É 0 no servidor e na
 * hidratação (sem `Date.now()` no render do servidor); quem usa deve esconder o tempo com 0.
 */
export const useNow = (): number =>
  useSyncExternalStore(
    subscribe,
    () => current || (current = Date.now()),
    () => 0,
  );
