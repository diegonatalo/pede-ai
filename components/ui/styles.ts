/**
 * Classes compartilhadas da identidade visual. Alvos de toque com pelo menos 44 px de altura,
 * foco sempre visível e cores só dos tokens do `globals.css` (funcionam nos dois temas).
 */

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const BASE_BUTTON = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 font-semibold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${FOCUS}`;

const SMALL = `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

const ROUND = `inline-flex shrink-0 items-center justify-center rounded-full text-lg font-bold transition active:scale-95 disabled:opacity-40 ${FOCUS}`;

export const BUTTON = {
  primary: `${BASE_BUTTON} bg-accent text-on-accent shadow-soft hover:bg-accent-strong`,
  secondary: `${BASE_BUTTON} border border-border bg-card text-foreground shadow-soft hover:border-accent/40 hover:bg-surface`,
  ghost: `${BASE_BUTTON} text-foreground hover:bg-surface`,
  /** Chamada principal de uma página (landing, cadastro). */
  primaryLarge: `inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-accent px-7 text-base font-semibold text-on-accent shadow-lift transition duration-150 hover:bg-accent-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${FOCUS}`,
  /** Ação destrutiva confirmada (ex.: "Confirmar exclusão"). */
  danger: `${BASE_BUTTON} bg-danger text-card hover:opacity-90`,
  /** Botão redondo só com ícone ou sinal (+/−). Precisa de `aria-label`. */
  icon: `${ROUND} size-11 border border-border bg-card shadow-soft hover:border-accent/40 hover:bg-surface`,
  /** Redondo menor, para os +/− dentro de um cartão. */
  iconSmall: `${ROUND} size-10 border border-border bg-card hover:border-accent/40 hover:bg-surface`,
  /** Redondo menor em destaque (o "+" de quem já está pedindo). */
  iconAccent: `${ROUND} size-10 bg-accent text-on-accent shadow-soft hover:bg-accent-strong`,
  /** Botão menor (ações dentro de listas), sem disputar classes com o tamanho padrão. */
  small: `${SMALL} border border-border bg-card hover:border-accent/40 hover:bg-surface`,
  smallPrimary: `${SMALL} bg-accent text-on-accent shadow-soft hover:bg-accent-strong`,
  smallGhost: `${SMALL} hover:bg-surface`,
  smallDanger: `${SMALL} bg-danger text-card hover:opacity-90`,
};

export const INPUT = `min-h-12 w-full rounded-2xl border border-border bg-card px-4 text-base shadow-[inset_0_1px_2px_rgb(var(--shadow)/0.05)] transition placeholder:text-muted/70 hover:border-muted/40 focus-visible:border-accent focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-accent/25`;

export const SELECT = `min-h-11 rounded-2xl border border-border bg-card px-3 font-medium transition hover:border-muted/40 ${FOCUS}`;

export const LABEL = "text-sm font-semibold";

export const CARD = "rounded-3xl border border-border bg-card shadow-soft";

/** Área recuada dentro de um cartão (resumos, formulários abertos). */
export const PANEL = "rounded-2xl bg-surface";

/** Lista vazia: borda tracejada e texto calmo. */
export const EMPTY = "rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted";

/** Contagem ao lado de um título. */
export const COUNT = "inline-flex min-w-6 items-center justify-center rounded-full bg-surface px-2 text-sm font-semibold text-muted";

/** Texto pequeno acima de um título. */
export const EYEBROW = "text-xs font-bold tracking-[0.14em] text-accent uppercase";

/** Avisos em bloco. O texto informa; a cor só reforça. */
export const ALERT = {
  danger: "rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger",
  warning: "rounded-2xl bg-warning-soft p-3 text-sm font-medium text-warning",
  success: "rounded-2xl bg-success-soft p-3 text-sm font-medium text-success",
  info: "rounded-2xl bg-info-soft p-3 text-sm font-medium text-info",
};

/** Etiquetas curtas (estado de item, contagem). */
export const BADGE = {
  neutral: "inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted",
  accent: "inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-on-accent",
  warning: "inline-flex items-center rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning",
  success: "inline-flex items-center rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success",
  info: "inline-flex items-center rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info",
  danger: "inline-flex items-center rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger",
};
