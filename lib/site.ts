/** URL pública do site. Para outro domínio, defina NEXT_PUBLIC_SITE_URL no build. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pede-ai.vercel.app"
).replace(/\/+$/, "");

export const SITE_NAME = "Pede Aí";
export const SITE_DESCRIPTION =
  "Pedidos pelo QR code da mesa, com comanda separada para cada pessoa, fila da cozinha e do bar, aviso ao garçom e conta dividida por comanda.";

/** Rotas públicas, usadas pelo sitemap. As telas da mesa e da equipe ficam fora. */
export const ROUTES = ["/"];
