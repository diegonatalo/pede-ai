import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";

/**
 * Cliente do login no navegador (sem React). Usa o endereço do próprio site,
 * então funciona igual no computador e na Vercel.
 */
export const authClient = createAuthClient({
  // Campos extras da conta (os mesmos de `user.additionalFields` em `lib/auth/server.ts`).
  plugins: [inferAdditionalFields({ user: { termsVersion: { type: "string", required: false } } })],
});
