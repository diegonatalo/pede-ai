/**
 * Versão dos termos de uso, no formato da data da mudança (`AAAA-MM-DD`). Trocar o valor
 * faz cada dono aceitar de novo no próximo acesso à conta.
 */
export const TERMS_VERSION = "2026-11-20";

/** O dono ainda não aceitou a versão atual dos termos. */
export const needsTermsAcceptance = (acceptedVersion: unknown) => acceptedVersion !== TERMS_VERSION;

/**
 * Campos de aceite para gravar na conta: só aceita a versão atual (o navegador não escolhe
 * a versão nem a data). Devolve `null` se a versão enviada não é a atual.
 */
export const termsAcceptance = (version: unknown, now: Date) =>
  version === TERMS_VERSION ? { termsVersion: TERMS_VERSION, termsAcceptedAt: now } : null;
