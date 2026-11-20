/** URL pública do site. Para outro domínio, defina NEXT_PUBLIC_SITE_URL no build. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://dn-pede-ai.vercel.app"
).replace(/\/+$/, "");

export const SITE_NAME = "Pede Aí";
export const SITE_DESCRIPTION =
  "Pedidos pelo QR code da mesa, com comanda separada para cada pessoa, fila da cozinha e do bar, aviso ao garçom e conta dividida por comanda.";

/**
 * Contato para pedidos sobre dados pessoais (LGPD, art. 18), mostrado em `/privacidade`.
 * TODO: trocar pelo e-mail definitivo; o standard-kit avisa enquanto este for o provisório.
 */
export const PRIVACY_EMAIL = "contato@exemplo.com.br";

/** Rotas públicas, usadas pelo sitemap. As telas da mesa e da equipe ficam fora. */
export const ROUTES = ["/", "/privacidade", "/termos"];
