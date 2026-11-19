import { roleOf } from "@/lib/actor";
import { isRecord, optionalString } from "@/lib/api/body";
import {
  IDENTITY_TTL_MS,
  isStaffRole,
  rolesOf,
  seatKey,
  type StaffActor,
  type StaffIdentity,
  type StaffRole,
} from "@/lib/api/identity";
import { error, fromResult, success, type ApiResult } from "@/lib/api/result";
import { generateJoinCode } from "@/lib/join-code";
import { computeDayReport } from "@/lib/metrics";
import type { CallStatus, ItemStatus, StaffMember, TabStatus } from "@/types/domain";
import type { RestaurantSettings, Store } from "@/types/store";

/** Serviços das telas da equipe. A pessoa já foi conferida contra o cookie (ver `resolveStaffActor`). */

/** O gerente pode usar qualquer tela; as outras pessoas, só a do próprio papel. */
const canUseScreen = (member: StaffMember, screen: StaffRole) => member.role === screen || member.role === "manager";

/** Entra numa tela da equipe com o PIN pessoal. O cookie guarda quem entrou em cada tela. */
export const staffLogin = async (
  store: Store,
  identity: StaffIdentity | null,
  body: unknown,
  now: number,
  restaurantId: string,
): Promise<ApiResult> => {
  if (!isRecord(body) || !isStaffRole(body.role) || typeof body.pin !== "string") return error("invalid_input");
  const result = await store.verifyStaffPin(body.pin.trim());
  if (!result.ok) return error(result.error);
  const member = result.value;
  if (!canUseScreen(member, body.role)) return error("wrong_screen");
  const seats = { ...(identity?.seats ?? {}), [seatKey(restaurantId, body.role)]: { id: member.id, name: member.name } };
  const staff = { seats, exp: now + IDENTITY_TTL_MS };
  return success({ roles: rolesOf(staff, restaurantId), name: member.name }, { staff });
};

/** Sai de uma tela do restaurante (ou de todas as telas dele, sem `role`). Outros restaurantes ficam. */
export const staffLogout = (identity: StaffIdentity | null, body: unknown, restaurantId: string): ApiResult => {
  if (!identity) return success({ roles: [] }, { staff: null });
  const role = isRecord(body) && isStaffRole(body.role) ? body.role : null;
  const seats = { ...identity.seats };
  for (const key of Object.keys(seats)) {
    if (role ? key === seatKey(restaurantId, role) : key.startsWith(`${restaurantId}:`)) delete seats[key];
  }
  const next = { seats, exp: identity.exp };
  const roles = rolesOf(next, restaurantId);
  return Object.keys(seats).length === 0 ? success({ roles }, { staff: null }) : success({ roles }, { staff: next });
};

/** A tela pedida na URL (`?role=`) precisa ter alguém da equipe que entrou com PIN. */
export const resolveStaffActor = (
  identity: StaffIdentity | null,
  role: string | null,
  restaurantId: string,
): StaffActor | ApiResult => {
  if (!isStaffRole(role)) return error("invalid_input");
  const seat = identity?.seats[seatKey(restaurantId, role)];
  if (!seat) return error("not_logged_in");
  return { role, staffId: seat.id, name: seat.name };
};

/** Tudo que as telas da equipe precisam: mesas, sessões abertas, cardápio e configuração. */
export const getStaffOverview = async (store: Store, actor: StaffActor): Promise<ApiResult> => {
  const [tables, sessions, menu, restaurant, { lastSeq }] = await Promise.all([
    store.listTables(),
    store.listOpenSessions(),
    store.getMenu(),
    store.getRestaurant(),
    store.getEvents(Number.MAX_SAFE_INTEGER),
  ]);
  // O código da mesa aparece para quem atende, não para a cozinha.
  const joinCodes: Record<string, string> = {};
  if (roleOf(actor) !== "kitchen") {
    for (const { session } of sessions) {
      const code = await store.getJoinCode(session.id, actor);
      if (code.ok) joinCodes[session.id] = code.value;
    }
  }
  // Quem está na tela, para o cabeçalho ("Garçom · Bruno").
  const me = typeof actor === "string" ? null : { name: actor.name, role: actor.role, staffId: actor.staffId };
  return success({ tables, sessions, menu, restaurant, joinCodes, lastSeq, me });
};

export const openTable = async (store: Store, actor: StaffActor, body: unknown): Promise<ApiResult> => {
  if (!isRecord(body) || typeof body.tableId !== "string") return error("invalid_input");
  const joinCode = generateJoinCode();
  return fromResult(await store.openSession(body.tableId, joinCode, actor), (session) => ({
    session,
    joinCode,
  }));
};

export const closeTable = async (store: Store, actor: StaffActor, sessionId: string) =>
  fromResult(await store.closeSession(sessionId, actor));

export const createStaffTab = async (store: Store, actor: StaffActor, body: unknown): Promise<ApiResult> => {
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
      actor,
    ),
  );
};

export const approveTab = async (store: Store, actor: StaffActor, tabId: string) =>
  fromResult(await store.approveTab(tabId, actor));

const readTo = (body: unknown) => (isRecord(body) && typeof body.to === "string" ? body.to : null);

export const setStaffTabStatus = async (store: Store, actor: StaffActor, tabId: string, body: unknown) => {
  const to = readTo(body);
  return to ? fromResult(await store.setTabStatus(tabId, to as TabStatus, actor)) : error("invalid_input");
};

export const setStaffItemStatus = async (store: Store, actor: StaffActor, itemId: string, body: unknown) => {
  const to = readTo(body);
  return to ? fromResult(await store.setItemStatus(itemId, to as ItemStatus, actor)) : error("invalid_input");
};

export const setStaffCallStatus = async (store: Store, actor: StaffActor, callId: string, body: unknown) => {
  const to = readTo(body);
  return to ? fromResult(await store.setCallStatus(callId, to as CallStatus, actor)) : error("invalid_input");
};

export const placeStaffOrder = async (store: Store, actor: StaffActor, body: unknown): Promise<ApiResult> => {
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
  return fromResult(await store.placeOrder({ tabId: body.tabId, lines }, actor));
};

export const setStaffItemShares = async (
  store: Store,
  actor: StaffActor,
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
  return fromResult(await store.setItemShares(itemId, shares, actor));
};

export const setAvailability = async (
  store: Store,
  actor: StaffActor,
  menuItemId: string,
  body: unknown,
): Promise<ApiResult> => {
  if (!isRecord(body) || typeof body.available !== "boolean") return error("invalid_input");
  return fromResult(await store.setItemAvailability(menuItemId, body.available, actor));
};

export const updateSettings = async (store: Store, actor: StaffActor, body: unknown): Promise<ApiResult> => {
  if (!isRecord(body)) return error("invalid_input");
  const settings: RestaurantSettings = {};
  if ("serviceFeePercent" in body) settings.serviceFeePercent = body.serviceFeePercent as number;
  if ("couvertCents" in body) settings.couvertCents = body.couvertCents as number;
  if ("requireFirstOrderApproval" in body)
    settings.requireFirstOrderApproval = body.requireFirstOrderApproval as boolean;
  return fromResult(await store.updateRestaurant(settings, actor));
};

/** Números do dia para o gerente. `since` é o início do dia no fuso de quem pede. */
export const getManagerReport = async (store: Store, actor: StaffActor, since: string | null): Promise<ApiResult> => {
  if (!since) return error("invalid_input");
  const sessions = await store.listSessionsSince(since, actor);
  if (!sessions.ok) return error(sessions.error);
  return success({ since, report: computeDayReport(sessions.value, await store.getRestaurant()) });
};

export const getStaffFeed = async (store: Store, after: number): Promise<ApiResult> => {
  const { events, lastSeq } = await store.getEvents(after);
  return success({ lastSeq, changed: events.length > 0 });
};

// --- Equipe (só o gerente; o store confere) ---

export const getTeam = async (store: Store, actor: StaffActor) => fromResult(await store.listStaff(actor));

export const createTeamMember = async (store: Store, actor: StaffActor, body: unknown): Promise<ApiResult> => {
  if (!isRecord(body) || typeof body.name !== "string" || !isStaffRole(body.role)) return error("invalid_input");
  return fromResult(await store.createStaff({ name: body.name, role: body.role }, actor));
};

export const resetTeamPin = async (store: Store, actor: StaffActor, staffId: string) =>
  fromResult(await store.resetStaffPin(staffId, actor));

export const setTeamActive = async (store: Store, actor: StaffActor, staffId: string, body: unknown): Promise<ApiResult> => {
  if (!isRecord(body) || typeof body.active !== "boolean") return error("invalid_input");
  return fromResult(await store.setStaffActive(staffId, body.active, actor));
};
