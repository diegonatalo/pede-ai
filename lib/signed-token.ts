/**
 * Token assinado com HMAC-SHA256: `<payload em base64url>.<assinatura em base64url>`.
 * O conteúdo fica legível, mas não pode ser alterado sem a chave. Usado nos cookies.
 */

const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array | ArrayBuffer) =>
  Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).toString("base64url");

const importKey = (secret: string) =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);

export const signToken = async (payload: unknown, secret: string): Promise<string> => {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await importKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(signature)}`;
};

/** Devolve o conteúdo se a assinatura conferir, senão `null`. Não confere validade de tempo. */
export const verifyToken = async (token: string | undefined, secret: string): Promise<unknown> => {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await importKey(secret),
      Buffer.from(signature, "base64url"),
      encoder.encode(body),
    );
    if (!valid) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};
