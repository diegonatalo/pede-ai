import type { StaffRole } from "@/types/domain";

export type { StaffRole };

export const STAFF_ROLES: readonly StaffRole[] = ["kitchen", "waiter", "manager"];

/** Aparelho do cliente: a mesa em que entrou e as comandas que abriu nela. */
export type CustomerIdentity = { sessionId: string; tabIds: string[]; exp: number };

/** Pessoa da equipe que entrou numa tela. */
export type StaffSeat = { id: string; name: string };

/**
 * Aparelho da equipe: quem entrou em cada tela (a demo abre várias no mesmo navegador,
 * e o gerente pode usar a do garçom com o próprio PIN).
 */
export type StaffIdentity = { seats: Partial<Record<StaffRole, StaffSeat>>; exp: number };

/** Quem está agindo numa tela da equipe: o papel da tela e a pessoa. Só o papel nos testes. */
export type StaffActor = StaffRole | { role: StaffRole; staffId: string; name: string };

export const rolesOf = (identity: StaffIdentity | null): StaffRole[] =>
  identity ? STAFF_ROLES.filter((role) => identity.seats[role]) : [];

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

const isSeat = (value: unknown): value is StaffSeat =>
  isRecord(value) && typeof value.id === "string" && typeof value.name === "string";

export const parseStaffIdentity = (value: unknown, nowMs: number): StaffIdentity | null => {
  if (!isRecord(value)) return null;
  const { seats, exp } = value;
  if (typeof exp !== "number" || exp <= nowMs || !isRecord(seats)) return null;
  const parsed: Partial<Record<StaffRole, StaffSeat>> = {};
  for (const [role, seat] of Object.entries(seats)) {
    if (!isStaffRole(role) || !isSeat(seat)) return null;
    parsed[role] = { id: seat.id, name: seat.name };
  }
  return Object.keys(parsed).length > 0 ? { seats: parsed, exp } : null;
};
