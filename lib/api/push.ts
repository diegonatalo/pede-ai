import { isRecord } from "@/lib/api/body";
import { roleOf } from "@/lib/actor";
import type { StaffActor } from "@/lib/api/identity";
import { error, success, type ApiResult } from "@/lib/api/result";
import { parseSubscription, type PushStore } from "@/lib/push";

/** Telas que recebem avisos: a do garçom (e o gerente quando usa a tela do garçom). */
const canSubscribe = (actor: StaffActor) => roleOf(actor) === "waiter" || roleOf(actor) === "manager";

/** Chave pública para o navegador se inscrever; `null` quando os avisos não estão configurados. */
export const getPushConfig = (actor: StaffActor, publicKey: string | null): ApiResult =>
  canSubscribe(actor) ? success({ publicKey }) : error("forbidden");

/** Inscreve este aparelho para receber os avisos do restaurante, em nome de quem entrou com o PIN. */
export const subscribePush = async (
  pushStore: PushStore,
  actor: StaffActor,
  restaurantId: string,
  body: unknown,
  now: string,
  enabled: boolean,
): Promise<ApiResult> => {
  if (!canSubscribe(actor) || typeof actor === "string") return error("forbidden");
  if (!enabled) return error("invalid_input");
  const subscription = isRecord(body) ? parseSubscription(body.subscription) : null;
  if (!subscription) return error("invalid_input");
  await pushStore.save({ ...subscription, restaurantId, staffId: actor.staffId, createdAt: now });
  return success({ subscribed: true });
};

/** Para de mandar avisos para este aparelho. */
export const unsubscribePush = async (pushStore: PushStore, actor: StaffActor, body: unknown): Promise<ApiResult> => {
  if (!canSubscribe(actor)) return error("forbidden");
  const endpoint = isRecord(body) && typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return error("invalid_input");
  await pushStore.remove(endpoint);
  return success({ subscribed: false });
};
