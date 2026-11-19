import { createHmac } from "node:crypto";
import { readSessionSecret } from "@/lib/api/config";

/** PIN da equipe: 4 a 8 dígitos (os da demonstração têm 4; os gerados, 6). */
export const isStaffPin = (value: unknown): value is string => typeof value === "string" && /^\d{4,8}$/.test(value);

export const STAFF_PIN_LENGTH = 6;

/** Sorteia um PIN de 6 dígitos com `crypto.getRandomValues` (viés do módulo desprezível). */
export const generateStaffPin = (
  random: (array: Uint32Array) => Uint32Array = (array) => crypto.getRandomValues(array),
): string => {
  const [value] = random(new Uint32Array(1));
  return String(value % 10 ** STAFF_PIN_LENGTH).padStart(STAFF_PIN_LENGTH, "0");
};

/**
 * Chave guardada no banco no lugar do PIN: HMAC com a chave do app e o restaurante.
 * Com ela dá para achar a pessoa pelo PIN numa consulta e impedir PIN repetido no restaurante;
 * quem vê só o banco não descobre os PINs (precisaria também da chave do app).
 */
export const staffPinKeyFor =
  (secret: string) =>
  (restaurantId: string, pin: string): string =>
    createHmac("sha256", secret).update(`${restaurantId}:${pin}`).digest("base64url");

export type StaffPinKey = ReturnType<typeof staffPinKeyFor>;

/** Chave com o segredo do ambiente (`SESSION_SECRET`). */
export const defaultStaffPinKey = (): StaffPinKey => staffPinKeyFor(readSessionSecret(process.env));
