/** Por quantos dias o nome na comanda, as observações e os recados ficam guardados depois que a mesa fecha. */
export const RETENTION_DAYS = 30;

/** Nome que fica no lugar do nome da pessoa depois do prazo. */
export const ANONYMOUS_NAME = "Cliente";

/** Mesas fechadas antes deste instante (ISO) já passaram do prazo. */
export const retentionCutoff = (now: Date, days = RETENTION_DAYS) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
