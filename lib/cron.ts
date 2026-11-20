import { timingSafeEqual } from "node:crypto";

/**
 * O agendador (GitHub Actions) chama as rotas agendadas com `Authorization: Bearer <CRON_SECRET>`.
 * Sem o segredo configurado, ninguém passa: a rota não fica aberta por engano.
 */
export const isCronAuthorized = (header: string | null, secret: string | undefined) => {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
};
