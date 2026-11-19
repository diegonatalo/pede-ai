import { isRecord, optionalString } from "@/lib/api/body";
import {
  IDENTITY_TTL_MS,
  isStaffRole,
  type StaffIdentity,
  type StaffRole,
} from "@/lib/api/identity";
import { error, fromResult, success, type ApiResult } from "@/lib/api/result";
import { generateJoinCode } from "@/lib/join-code";
import type { CallStatus, ItemStatus, TabStatus } from "@/types/domain";
import type { RestaurantSettings, Store } from "@/types/store";

/** Serviços das telas da equipe. O papel já foi conferido contra o cookie (ver `resolveStaffRole`). */

export type StaffPins = Record<StaffRole, string>;

/** Compara sem sair no primeiro caractere diferente, para não vazar o PIN pelo tempo. */
const sameText = (a: string, b: string) => {
  let diff = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
};

export const staffLogin = (
  identity: StaffIdentity | null,
  body: unknown,
  pins: StaffPins,
  now: number,
): ApiResult => {
  if (!isRecord(body) || !isStaffRole(body.role) || typeof body.pin !== "string") return error("invalid_input");
  if (!sameText(body.pin.trim(), pins[body.role])) return error("wrong_pin");
  const roles = [...new Set([...(identity?.roles ?? []), body.role])];
  return success({ roles }, { staff: { roles, exp: now + IDENTITY_TTL_MS } });
};

export const staffLogout = (identity: StaffIdentity | null, body: unknown): ApiResult => {
  const role = isRecord(body) && isStaffRole(body.role) ? body.role : null;
  const roles = role ? (identity?.roles ?? []).filter((entry) => entry !== role) : [];
  if (roles.length === 0 || !identity) return success({ roles: [] }, { staff: null });
  return success({ roles }, { staff: { roles, exp: identity.exp } });
};

/** O papel pedido na URL (`?role=`) precisa estar entre os que entraram com PIN. */
export const resolveStaffRole = (identity: StaffIdentity | null, role: string | null): StaffRole | ApiResult => {
  if (!isStaffRole(role)) return error("invalid_input");
  if (!identity?.roles.includes(role)) return error("not_logged_in");
  return role;
};

/** Tudo que as telas da equipe precisam: mesas, sessões abertas, cardápio e configuração. */
export const getStaffOverview = async (store: Store, role: StaffRole): Promise<ApiResult> => {
  const [tables, sessions, menu, restaurant, { lastSeq }] = await Promise.all([
    store.listTables(),
    store.listOpenSessions(),
    store.getMenu(),
    store.getRestaurant(),
    store.getEvents(Number.MAX_SAFE_INTEGER),
  ]);
  // O código da mesa aparece para quem atende, não para a cozinha.
  const joinCodes: Record<string, string> = {};
  if (role !== "kitchen") {
    for (const { session } of sessions) {
      const code = await store.getJoinCode(session.id, role);
      if (code.ok) joinCodes[session.id] = code.value;
    }
  }
  return success({ tables, sessions, menu, restaurant, joinCodes, lastSeq });
};

export const openTable = async (store: Store, role: StaffRole, body: unknown): Promise<ApiResult> => {
  if (!isRecord(body) || typeof body.tableId !== "string") return error("invalid_input");
  const joinCode = generateJoinCode();
  return fromResult(await store.openSession(body.tableId, joinCode, role), (session) => ({
    session,
    joinCode,
  }));
};

export const closeTable = async (store: Store, role: StaffRole, sessionId: string) =>
  fromResult(await store.closeSession(sessionId, role));

export const createStaffTab = async (store: Store, role: StaffRole, body: unknown): Promise<ApiResult> => {
  if (
    !isRecord(body) ||
    typeof body.sessionId !== "string" ||
    typeof body.customerName !== "string" ||
    typeof body.peopleCount !== "number"
  )
    return error("invalid_input");
  return fromResult(
    await store.createTab(
      { sessionId: body.sessionId, customerName: body.customerName, peopleCount: body.peopleCount },
      role,
    ),
  );
};

export const approveTab = async (store: Store, role: StaffRole, tabId: string) =>
  fromResult(await store.approveTab(tabId, role));

const readTo = (body: unknown) => (isRecord(body) && typeof body.to === "string" ? body.to : null);

export const setStaffTabStatus = async (store: Store, role: StaffRole, tabId: string, body: unknown) => {
  const to = readTo(body);
  return to ? fromResult(await store.setTabStatus(tabId, to as TabStatus, role)) : error("invalid_input");
};

export const setStaffItemStatus = async (store: Store, role: StaffRole, itemId: string, body: unknown) => {
  const to = readTo(body);
  return to ? fromResult(await store.setItemStatus(itemId, to as ItemStatus, role)) : error("invalid_input");
};

export const setStaffCallStatus = async (store: Store, role: StaffRole, callId: string, body: unknown) => {
  const to = readTo(body);
  return to ? fromResult(await store.setCallStatus(callId, to as CallStatus, role)) : error("invalid_input");
};

export const placeStaffOrder = async (store: Store, role: StaffRole, body: unknown): Promise<ApiResult> => {
  if (!isRecord(body) || typeof body.tabId !== "string" || !Array.isArray(body.lines))
    return error("invalid_input");
  const lines = [];
  for (const line of body.lines) {
    if (!isRecord(line) || typeof line.menuItemId !== "string" || typeof line.quantity !== "number")
      return error("invalid_input");
    const note = optionalString(line.note);
    if (note === null) return error("invalid_input");
    lines.push({ menuItemId: line.menuItemId, quantity: line.quantity, note });
  }
  return fromResult(await store.placeOrder({ tabId: body.tabId, lines }, role));
};

export const setStaffItemShares = async (
  store: Store,
  role: StaffRole,
  itemId: string,
  body: unknown,
): Promise<ApiResult> => {
  if (!isRecord(body) || !Array.isArray(body.shares)) return error("invalid_input");
  const shares = [];
  for (const share of body.shares) {
    if (!isRecord(share) || typeof share.tabId !== "string" || typeof share.parts !== "number")
      return error("invalid_input");
    shares.push({ tabId: share.tabId, parts: share.parts });
  }
  return fromResult(await store.setItemShares(itemId, shares, role));
};

export const setAvailability = async (
  store: Store,
  role: StaffRole,
  menuItemId: string,
  body: unknown,
): Promise<ApiResult> => {
  if (!isRecord(body) || typeof body.available !== "boolean") return error("invalid_input");
  return fromResult(await store.setItemAvailability(menuItemId, body.available, role));
};

export const updateSettings = async (store: Store, role: StaffRole, body: unknown): Promise<ApiResult> => {
  if (!isRecord(body)) return error("invalid_input");
  const settings: RestaurantSettings = {};
  if ("serviceFeePercent" in body) settings.serviceFeePercent = body.serviceFeePercent as number;
  if ("couvertCents" in body) settings.couvertCents = body.couvertCents as number;
  if ("requireFirstOrderApproval" in body)
    settings.requireFirstOrderApproval = body.requireFirstOrderApproval as boolean;
  return fromResult(await store.updateRestaurant(settings, role));
};

export const getStaffFeed = async (store: Store, after: number): Promise<ApiResult> => {
  const { events, lastSeq } = await store.getEvents(after);
  return success({ lastSeq, changed: events.length > 0 });
};
