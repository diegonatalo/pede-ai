/** Classes compartilhadas dos controles. Alvos de toque com pelo menos 44 px de altura. */

const BASE_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

export const BUTTON = {
  primary: `${BASE_BUTTON} bg-accent text-on-accent hover:opacity-90`,
  secondary: `${BASE_BUTTON} border border-border bg-card hover:bg-border/40`,
  ghost: `${BASE_BUTTON} hover:bg-border/40`,
  /** Botão redondo só com ícone ou sinal (+/−). Precisa de `aria-label`. */
  icon: "inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-lg font-bold hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40",
};

export const INPUT =
  "min-h-11 w-full rounded-xl border border-border bg-card px-4 text-base placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

export const LABEL = "text-sm font-semibold";

export const CARD = "rounded-2xl border border-border bg-card";
