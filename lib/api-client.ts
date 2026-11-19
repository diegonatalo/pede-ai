/**
 * Chamadas à API do próprio app. Sempre JSON, sem cache, com o cookie do aparelho.
 * Erros viram `{ ok: false }` com o código e a mensagem para mostrar na tela.
 */

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; message: string };

const NETWORK_MESSAGE = "Sem conexão. Confira a internet e tente de novo.";

export const apiRequest = async <T>(
  path: string,
  { method = "GET", body }: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<ApiResponse<T>> => {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      headers: method === "GET" ? undefined : { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, status: 0, error: "network", message: NETWORK_MESSAGE };
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Resposta sem JSON (ex.: 500 do servidor): cai na mensagem genérica abaixo.
  }

  if (response.ok) return { ok: true, data: data as T };
  const payload = (data ?? {}) as { error?: unknown; message?: unknown };
  return {
    ok: false,
    status: response.status,
    error: typeof payload.error === "string" ? payload.error : "unknown",
    message: typeof payload.message === "string" ? payload.message : "Algo deu errado. Tente de novo.",
  };
};
