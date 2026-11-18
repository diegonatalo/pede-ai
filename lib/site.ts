/** URL pública do site. Para outro domínio, defina NEXT_PUBLIC_SITE_URL no build. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pede-ai.vercel.app"
).replace(/\/+$/, "");

export const SITE_NAME = "Pede Ai";
export const SITE_DESCRIPTION = "TODO: descreva o projeto em uma frase.";

/** Rotas públicas, usadas pelo sitemap. */
export const ROUTES = ["/"];
