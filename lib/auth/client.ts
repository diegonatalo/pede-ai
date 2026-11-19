import { createAuthClient } from "better-auth/client";

/**
 * Cliente do login no navegador (sem React). Usa o endereço do próprio site,
 * então funciona igual no computador e na Vercel.
 */
export const authClient = createAuthClient();
