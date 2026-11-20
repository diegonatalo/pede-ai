import { sendNotification } from "web-push";
import type { PushMessage, PushStore } from "@/lib/push";
import { SITE_URL } from "@/lib/site";
import type { Store } from "@/types/store";

type Env = Record<string, string | undefined>;

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

/**
 * Chaves VAPID do app (geradas uma vez, ver o README). Sem elas, os avisos ficam desligados:
 * a tela do garçom esconde o botão e nada é enviado.
 */
export const vapidConfig = (env: Env): VapidConfig | null =>
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
    ? { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || SITE_URL }
    : null;

type Send = typeof sendNotification;

/** Opções de envio: assinatura VAPID, validade curta, prioridade alta e um tópico por assunto. */
export const pushOptions = (config: VapidConfig, message: PushMessage) => ({
  vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
  // Aviso velho não serve: se o aparelho ficar 5 minutos sem rede, o serviço descarta.
  TTL: 300,
  urgency: "high" as const,
  // O serviço de push troca um aviso pendente pelo mais novo do mesmo tópico.
  topic: message.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, "-"),
});

/**
 * Manda o aviso para todos os aparelhos da equipe inscritos no restaurante. Tira da lista quem
 * foi desativado e os aparelhos que o serviço de push diz que não existem mais (404/410).
 */
export const sendToStaff = async ({
  restaurantId,
  store,
  pushStore,
  message,
  config,
  send = sendNotification,
}: {
  restaurantId: string;
  store: Pick<Store, "getStaffMember">;
  pushStore: PushStore;
  message: PushMessage;
  config: VapidConfig;
  send?: Send;
}) => {
  const subscriptions = await pushStore.listForRestaurant(restaurantId);
  let delivered = 0;
  await Promise.all(
    subscriptions.map(async (subscription) => {
      const member = await store.getStaffMember(subscription.staffId);
      if (!member?.active) {
        await pushStore.remove(subscription.endpoint);
        return;
      }
      try {
        await send(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify(message),
          pushOptions(config, message),
        );
        delivered += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await pushStore.remove(subscription.endpoint);
        else console.error("pede-ai: aviso não enviado", status ?? error);
      }
    }),
  );
  return delivered;
};
