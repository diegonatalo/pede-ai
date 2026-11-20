import { after } from "next/server";
import { sendToStaff, vapidConfig } from "@/lib/push-send";
import type { PushMessage } from "@/lib/push";
import { getPushStore } from "@/lib/store";
import type { Store } from "@/types/store";

/**
 * Avisa os aparelhos da equipe depois de responder (o cliente não espera o envio). `build` monta a
 * mensagem com o endereço do restaurante; devolver `null` cancela. Sem chaves VAPID, não faz nada.
 */
export const notifyStaff = (store: Store, build: (slug: string) => Promise<PushMessage | null>) => {
  const config = vapidConfig(process.env);
  if (!config) return;
  after(async () => {
    try {
      const restaurant = await store.getRestaurant();
      const message = await build(restaurant.slug);
      if (message) await sendToStaff({ restaurantId: restaurant.id, store, pushStore: getPushStore(), message, config });
    } catch (failure) {
      console.error("pede-ai: falha ao avisar a equipe", failure);
    }
  });
};
