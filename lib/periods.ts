/** Períodos dos números do gerente, no fuso do aparelho de quem olha. */
export type PeriodPreset = "today" | "yesterday" | "last7" | "month" | "custom";

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last7: "Últimos 7 dias",
  month: "Este mês",
  custom: "Escolher datas",
};

/** Maior período aceito (a API também limita). */
export const MAX_PERIOD_DAYS = 366;

export type PeriodRange = { since: string; until: string; label: string };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** "2026-11-20" → meia-noite local daquele dia; `null` se não for uma data válida. */
export const parseLocalDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
};

/** Data local no formato dos campos de data: 2026-11-20. */
export const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const short = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Início (inclusive) e fim (exclusive) do período, em ISO, e o nome para mostrar.
 * `custom` usa `from` e `to` (datas inteiras, as duas incluídas). `null` se as datas não servem.
 */
export const periodRange = (
  preset: PeriodPreset,
  now: Date,
  custom?: { from: string; to: string },
): PeriodRange | null => {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const range = (start: Date, end: Date, label: string): PeriodRange => ({
    since: start.toISOString(),
    until: end.toISOString(),
    label,
  });
  switch (preset) {
    case "today":
      return range(today, tomorrow, "Hoje");
    case "yesterday":
      return range(addDays(today, -1), today, "Ontem");
    case "last7":
      return range(addDays(today, -6), tomorrow, "Últimos 7 dias");
    case "month":
      return range(new Date(today.getFullYear(), today.getMonth(), 1), tomorrow, "Este mês");
    case "custom": {
      const from = custom && parseLocalDate(custom.from);
      const to = custom && parseLocalDate(custom.to);
      if (!from || !to || from > to) return null;
      const end = addDays(to, 1);
      if ((end.getTime() - from.getTime()) / 86_400_000 > MAX_PERIOD_DAYS + 1) return null;
      const label = from.getTime() === to.getTime() ? short.format(from) : `${short.format(from)} a ${short.format(to)}`;
      return range(from, end, label);
    }
  }
};
