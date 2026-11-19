import type { Role } from "@/types/domain";

export type StaffRole = Exclude<Role, "customer">;

export const STAFF_ROLES: readonly StaffRole[] = ["kitchen", "waiter", "manager"];

/** Aparelho do cliente: a mesa em que entrou e as comandas que abriu nela. */
export type CustomerIdentity = { sessionId: string; tabIds: string[]; exp: number };

/** Aparelho da equipe: os papéis em que já entrou com o PIN (a demo abre vários no mesmo navegador). */
export type StaffIdentity = { roles: StaffRole[]; exp: number };

export const IDENTITY_TTL_MS = 12 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isStaffRole = (value: unknown): value is StaffRole =>
  typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);

/** Lê o conteúdo do cookie do cliente; `null` se estiver malformado ou vencido. */
export const parseCustomerIdentity = (value: unknown, nowMs: number): CustomerIdentity | null => {
  if (!isRecord(value)) return null;
  const { sessionId, tabIds, exp } = value;
  if (typeof sessionId !== "string" || typeof exp !== "number" || exp <= nowMs) return null;
  if (!Array.isArray(tabIds) || !tabIds.every((id) => typeof id === "string")) return null;
  return { sessionId, tabIds, exp };
};

export const parseStaffIdentity = (value: unknown, nowMs: number): StaffIdentity | null => {
  if (!isRecord(value)) return null;
  const { roles, exp } = value;
  if (typeof exp !== "number" || exp <= nowMs) return null;
  if (!Array.isArray(roles) || roles.length === 0 || !roles.every(isStaffRole)) return null;
  return { roles: [...new Set(roles)], exp };
};
