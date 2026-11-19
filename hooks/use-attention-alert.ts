"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Dois bipes curtos, gerados na hora (sem arquivo de áudio). */
const beep = (context: AudioContext) => {
  for (const [offset, frequency] of [
    [0, 880],
    [0.18, 1175],
  ] as const) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.2, context.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + offset + 0.15);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + 0.16);
  }
};

/**
 * Avisa (som e vibração) quando `count` aumenta: item pronto, chamado novo, pedido para confirmar.
 * O navegador só toca som depois de um toque na página, por isso o som começa desligado
 * e é ligado pelo botão que chama `enableSound`.
 */
export const useAttentionAlert = (count: number) => {
  const previous = useRef(count);
  const context = useRef<AudioContext | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    if (count > previous.current) {
      if (soundOn && context.current) beep(context.current);
      navigator.vibrate?.([120, 60, 120]);
    }
    previous.current = count;
  }, [count, soundOn]);

  const toggleSound = useCallback(() => {
    if (!soundOn) {
      context.current ??= new AudioContext();
      void context.current.resume();
      beep(context.current);
    }
    setSoundOn(!soundOn);
  }, [soundOn]);

  return { soundOn, toggleSound };
};
