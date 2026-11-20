import { CALL_REASON_LABEL } from "@/lib/labels";
import type { OrderItem, WaiterCall } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

/** Inscrição de um aparelho da equipe para receber avisos (Web Push), no restaurante. */
export type PushSubscriptionRecord = {
  endpoint: string;
  restaurantId: string;
  staffId: string;
  p256dh: string;
  auth: string;
  createdAt: string;
};

/** Guarda das inscrições (memória e Postgres). */
export type PushStore = {
  /** Grava ou troca a inscrição deste endereço de envio (um aparelho tem um só). */
  save(record: PushSubscriptionRecord): Promise<void>;
  remove(endpoint: string): Promise<void>;
  listForRestaurant(restaurantId: string): Promise<PushSubscriptionRecord[]>;
};

/** O que aparece no aviso. `tag` agrupa: um aviso novo da mesma coisa troca o anterior. */
export type PushMessage = { title: string; body: string; tag: string; url: string };

const MAX_ENDPOINT = 2048;
const MAX_KEY = 256;

/** Lê a inscrição que o navegador gera (`PushSubscription.toJSON()`); `null` se não serve. */
export const parseSubscription = (value: unknown): { endpoint: string; p256dh: string; auth: string } | null => {
  if (typeof value !== "object" || value === null) return null;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT || !endpoint.startsWith("https://")) return null;
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || !p256dh || !auth) return null;
  if (p256dh.length > MAX_KEY || auth.length > MAX_KEY) return null;
  return { endpoint, p256dh, auth };
};

const waiterUrl = (slug: string) => `/r/${slug}/garcom`;

/** Primeiro pedido de uma comanda, esperando o garçom confirmar. */
export const approvalMessage = (snapshot: SessionSnapshot, tabId: string, slug: string): PushMessage | null => {
  const tab = snapshot.tabs.find((entry) => entry.id === tabId);
  if (!tab) return null;
  return {
    title: "Pedido para confirmar",
    body: `${snapshot.table.label} · ${tab.customerName}`,
    tag: `aprovar-${tab.id}`,
    url: waiterUrl(slug),
  };
};

/** Item pronto na cozinha ou no bar, para o garçom levar. */
export const readyMessage = (snapshot: SessionSnapshot, item: OrderItem, slug: string): PushMessage => ({
  title: "Pronto para levar",
  body: `${item.quantity}× ${item.nameSnapshot} · ${snapshot.table.label}`,
  tag: `pronto-${item.id}`,
  url: waiterUrl(slug),
});

/** Cliente chamou o garçom (dúvida, conta ou outro motivo). */
export const callMessage = (snapshot: SessionSnapshot, call: WaiterCall, slug: string): PushMessage => {
  const tab = call.tabId ? snapshot.tabs.find((entry) => entry.id === call.tabId) : undefined;
  const who = tab ? `${snapshot.table.label} · ${tab.customerName}` : snapshot.table.label;
  return {
    title: call.reason === "bill" ? "Pediram a conta" : "Chamaram o garçom",
    body: call.message ? `${who}: ${call.message}` : `${who} · ${CALL_REASON_LABEL[call.reason]}`,
    tag: `chamado-${call.id}`,
    url: waiterUrl(slug),
  };
};

/** Chave pública VAPID (base64url) no formato que o `pushManager.subscribe` pede. */
export const decodeBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};
