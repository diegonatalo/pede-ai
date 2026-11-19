import type { Role } from "@/types/domain";

/** Limites de entrada, iguais nos dois adaptadores. */
export const LIMITS = {
  customerName: 40,
  note: 140,
  callMessage: 280,
  peopleCount: 20,
  quantity: 20,
  linesPerOrder: 30,
  serviceFeePercent: 30,
  couvertCents: 10_000,
  joinAttempts: 5,
  joinLockMinutes: 5,
} as const;

export const STAFF: readonly Role[] = ["waiter", "manager"];

export const isIntInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/** Tira espaços das pontas; devolve `null` se ficar vazio ou passar do limite. */
export const cleanText = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > 0 && text.length <= max ? text : null;
};

/** Texto opcional: vazio vira `undefined`; acima do limite é inválido (`null`). */
export const cleanOptionalText = (value: unknown, max: number): string | undefined | null => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length === 0) return undefined;
  return text.length <= max ? text : null;
};

export const isJoinCode = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}$/.test(value);
