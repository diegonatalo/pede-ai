import type { StaffPins } from "@/lib/api/staff";

/** PINs da demonstração, mostrados na página inicial. Em produção, defina as variáveis. */
export const DEMO_PINS: StaffPins = { kitchen: "1111", waiter: "2222", manager: "3333" };

type Env = Record<string, string | undefined>;

export const readStaffPins = (env: Env): StaffPins => ({
  kitchen: env.STAFF_PIN_KITCHEN || DEMO_PINS.kitchen,
  waiter: env.STAFF_PIN_WAITER || DEMO_PINS.waiter,
  manager: env.STAFF_PIN_MANAGER || DEMO_PINS.manager,
});

const holder = globalThis as typeof globalThis & { __pedeAiSecret?: string };

/**
 * Chave que assina os cookies. Sem `SESSION_SECRET`, usa uma aleatória por processo:
 * serve para o adaptador em memória, que também vive num processo só.
 */
export const readSessionSecret = (env: Env): string => {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  holder.__pedeAiSecret ??= Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  return holder.__pedeAiSecret;
};
