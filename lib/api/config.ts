type Env = Record<string, string | undefined>;

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
