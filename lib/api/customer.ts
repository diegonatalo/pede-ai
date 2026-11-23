import { isRecord, optionalString } from "@/lib/api/body";
import { IDENTITY_TTL_MS, type CustomerIdentity } from "@/lib/api/identity";
import { error, fromResult, success, type ApiResult } from "@/lib/api/result";
import type { FailureGuard } from "@/lib/rate-limit";
import { customerView, tabOfItem } from "@/lib/views";
import type { CallReason, CallStatus, ItemStatus, TabStatus } from "@/types/domain";
import type { SessionSnapshot, Store } from "@/types/store";

/** Serviços do celular do cliente. Cada um confere que a comanda, o item ou o chamado é dele. */

type Identity = CustomerIdentity | null;

const renew = (identity: Omit<CustomerIdentity, "exp">, now: number): CustomerIdentity => ({
  ...identity,
  exp: now + IDENTITY_TTL_MS,
});

/** Carrega a mesa do cliente; mesa fechada ou sumida apaga o cookie. */
const loadMine = async (
  store: Store,
  identity: Identity,
): Promise<{ snapshot: SessionSnapshot; identity: CustomerIdentity } | ApiResult> => {
  if (!identity) return error("not_joined");
  const result = await store.getSessionSnapshot(identity.sessionId);
  if (!result.ok) return error("not_joined", { customer: null });
  if (result.value.session.status !== "open") return error("session_closed", { customer: null });
  return { snapshot: result.value, identity };
};

const isFailure = (value: object): value is ApiResult => "status" in value;

/** Mesa do QR code. Mesa que não existe responde `table: null` (200), sem sujar o console. */
export const getTableStatus = async (store: Store, tableId: string): Promise<ApiResult> => {
  const table = (await store.listTables()).find((entry) => entry.id === tableId);
  if (!table) return success({ table: null, open: false });
  const session = await store.getOpenSessionByTable(tableId);
  return success({ table, open: session !== null });
};

/** Limite de códigos errados de quem está tentando (o endereço de internet), em todas as mesas. */
export type JoinGuard = FailureGuard;

export const joinTable = async (
  store: Store,
  identity: Identity,
  tableId: string,
  body: unknown,
  now: number,
  guard?: JoinGuard,
): Promise<ApiResult> => {
  if (!isRecord(body) || typeof body.code !== "string") return error("invalid_input");
  if (guard && (await guard.isBlocked())) return error("locked");
  const session = await store.getOpenSessionByTable(tableId);
  if (!session) return error("session_closed");
  const verified = await store.verifyJoinCode(session.id, body.code.trim());
  if (!verified.ok) {
    if (verified.error === "wrong_code") await guard?.recordFailure();
    return error(verified.error);
  }
  // Quem já estava nesta mesa mantém as comandas; outra mesa começa do zero.
  const tabIds = identity?.sessionId === session.id ? identity.tabIds : [];
  return success({ sessionId: session.id }, { customer: renew({ sessionId: session.id, tabIds }, now) });
};

/**
 * Leitura da tela do cliente. Responde sempre 200 com `state` (`guest`, `closed` ou `ready`):
 * quem ainda não entrou não é um erro, e um 401 sujaria o console do navegador.
 */
export const getCustomerView = async (store: Store, identity: Identity): Promise<ApiResult> => {
  if (!identity) return success({ state: "guest" });
  const result = await store.getSessionSnapshot(identity.sessionId);
  if (!result.ok) return success({ state: "guest" }, { customer: null });
  if (result.value.session.status !== "open") return success({ state: "closed" }, { customer: null });
  const { lastSeq } = await store.getEvents(Number.MAX_SAFE_INTEGER);
  const [restaurant, mapSpots] = await Promise.all([store.getRestaurant(), store.listMapSpots()]);
  const view = customerView(result.value, restaurant, identity.tabIds, mapSpots);
  return success({ state: "ready", ...view, lastSeq });
};

export const createCustomerTab = async (
  store: Store,
  identity: Identity,
  body: unknown,
  now: number,
): Promise<ApiResult> => {
  const loaded = await loadMine(store, identity);
  if (isFailure(loaded)) return loaded;
  if (!isRecord(body) || typeof body.customerName !== "string" || typeof body.peopleCount !== "number")
    return error("invalid_input");
  const result = await store.createTab(
    { sessionId: loaded.snapshot.session.id, customerName: body.customerName, peopleCount: body.peopleCount },
    "customer",
  );
  if (!result.ok) return error(result.error);
  const tabIds = [...loaded.identity.tabIds, result.value.id];
  return success(result.value, { customer: renew({ sessionId: loaded.identity.sessionId, tabIds }, now) });
};

export const placeCustomerOrder = async (
  store: Store,
  identity: Identity,
  body: unknown,
): Promise<ApiResult> => {
  const loaded = await loadMine(store, identity);
  if (isFailure(loaded)) return loaded;
  if (!isRecord(body) || typeof body.tabId !== "string" || !Array.isArray(body.lines))
    return error("invalid_input");
  if (!loaded.identity.tabIds.includes(body.tabId)) return error("forbidden");
  const lines = [];
  for (const line of body.lines) {
    if (!isRecord(line) || typeof line.menuItemId !== "string" || typeof line.quantity !== "number")
      return error("invalid_input");
    const note = optionalString(line.note);
    if (note === null) return error("invalid_input");
    lines.push({ menuItemId: line.menuItemId, quantity: line.quantity, note });
  }
  return fromResult(await store.placeOrder({ tabId: body.tabId, lines }, "customer"));
};

export const setCustomerTabStatus = async (
  store: Store,
  identity: Identity,
  tabId: string,
  body: unknown,
): Promise<ApiResult> => {
  const loaded = await loadMine(store, identity);
  if (isFailure(loaded)) return loaded;
  if (!loaded.identity.tabIds.includes(tabId)) return error("forbidden");
  if (!isRecord(body) || typeof body.to !== "string") return error("invalid_input");
  return fromResult(await store.setTabStatus(tabId, body.to as TabStatus, "customer"));
};

/** O cliente mexe só nos itens que a própria comanda pediu. */
const ownItem = (loaded: { snapshot: SessionSnapshot; identity: CustomerIdentity }, itemId: string) => {
  const item = loaded.snapshot.items.find((entry) => entry.id === itemId);
  if (!item) return error("not_found");
  const owner = tabOfItem(loaded.snapshot, item);
  return owner && loaded.identity.tabIds.includes(owner) ? null : error("forbidden");
};

export const setCustomerItemStatus = async (
  store: Store,
  identity: Identity,
  itemId: string,
  body: unknown,
): Promise<ApiResult> => {
  const loaded = await loadMine(store, identity);
  if (isFailure(loaded)) return loaded;
  const denied = ownItem(loaded, itemId);
  if (denied) return denied;
  if (!isRecord(body) || typeof body.to !== "string") return error("invalid_input");
  return fromResult(await store.setItemStatus(itemId, body.to as ItemStatus, "customer"));
};

export const setCustomerItemShares = async (
  store: Store,
  identity: Identity,
  itemId: string,
  body: unknown,
): Promise<ApiResult> => {
  const loaded = await loadMine(store, identity);
  if (isFailure(loaded)) return loaded;
  const denied = ownItem(loaded, itemId);
  if (denied) return denied;
  if (!isRecord(body) || !Array.isArray(body.shares)) return error("invalid_input");
  const shares = [];
  for (const share of body.shares) {
    if (!isRecord(share) || typeof share.tabId !== "string" || typeof share.parts !== "number")
      return error("invalid_input");
    shares.push({ tabId: share.tabId, parts: share.parts });
  }
  return fromResult(await store.setItemShares(itemId, shares, "customer"));
};

export const createCustomerCall = async (
  store: Store,
  identity: Identity,
  body: unknown,
): Promise<ApiResult> => {
  const loaded = await loadMine(store, identity);
  if (isFailure(loaded)) return loaded;
  if (!isRecord(body) || typeof body.tabId !== "string" || typeof body.reason !== "string")
    return error("invalid_input");
  if (!loaded.identity.tabIds.includes(body.tabId)) return error("forbidden");
  const message = optionalString(body.message);
  if (message === null) return error("invalid_input");
  return fromResult(
    await store.createCall(
      {
        sessionId: loaded.snapshot.session.id,
        tabId: body.tabId,
        reason: body.reason as CallReason,
        message,
      },
      "customer",
    ),
  );
};

export const setCustomerCallStatus = async (
  store: Store,
  identity: Identity,
  callId: string,
  body: unknown,
): Promise<ApiResult> => {
  const loaded = await loadMine(store, identity);
  if (isFailure(loaded)) return loaded;
  const call = loaded.snapshot.calls.find((entry) => entry.id === callId);
  if (!call) return error("not_found");
  if (!call.tabId || !loaded.identity.tabIds.includes(call.tabId)) return error("forbidden");
  if (!isRecord(body) || typeof body.to !== "string") return error("invalid_input");
  return fromResult(await store.setCallStatus(callId, body.to as CallStatus, "customer"));
};

/**
 * Polling: diz se algo mudou na mesa depois de `after`. Sem acesso ou com a mesa fechada,
 * responde `changed: true` para a tela reler a visão e descobrir o motivo (sem erro no console).
 */
export const getCustomerFeed = async (store: Store, identity: Identity, after: number): Promise<ApiResult> => {
  const result = identity ? await store.getSessionSnapshot(identity.sessionId) : null;
  if (!result?.ok || result.value.session.status !== "open") return success({ lastSeq: after, changed: true });
  const { events, lastSeq } = await store.getEvents(after, result.value.session.id);
  return success({ lastSeq, changed: events.length > 0 });
};
