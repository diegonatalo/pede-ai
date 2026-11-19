/** Checagens de forma do corpo das requisições. As regras de conteúdo ficam no store. */

export type Body = Record<string, unknown>;

export const isRecord = (value: unknown): value is Body =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const optionalString = (value: unknown): string | undefined | null =>
  value === undefined ? undefined : typeof value === "string" ? value : null;

/** Converte `?after=` em número de sequência; inválido vira 0 (manda tudo de novo). */
export const parseAfter = (value: string | null): number => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
};
