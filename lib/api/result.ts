import type { CustomerIdentity, StaffIdentity } from "@/lib/api/identity";
import type { Result, StoreError } from "@/types/store";

export type ApiError =
  | StoreError
  | "unsupported_media_type"
  | "not_joined"
  | "not_logged_in"
  | "wrong_pin";

/**
 * Resposta de um serviço da API, sem depender do Next: os Route Handlers só a convertem.
 * `customer`/`staff` presentes mandam gravar (objeto) ou apagar (`null`) o cookie.
 */
export type ApiResult = {
  status: number;
  body: unknown;
  customer?: CustomerIdentity | null;
  staff?: StaffIdentity | null;
};

const STATUS: Record<ApiError, number> = {
  invalid_input: 400,
  empty: 400,
  invalid_parts: 400,
  duplicate_tab: 400,
  unknown_tab: 400,
  wrong_code: 401,
  wrong_pin: 401,
  not_joined: 401,
  not_logged_in: 401,
  forbidden: 403,
  not_found: 404,
  invalid_transition: 409,
  session_closed: 409,
  tab_closed: 409,
  item_unavailable: 409,
  cannot_close: 409,
  already_open: 409,
  unsupported_media_type: 415,
  locked: 429,
};

/** Mensagem para a pessoa ver na tela. */
export const ERROR_MESSAGES: Record<ApiError, string> = {
  invalid_input: "Confira os dados e tente de novo.",
  empty: "Escolha pelo menos uma comanda.",
  invalid_parts: "As partes precisam ser números inteiros a partir de 1.",
  duplicate_tab: "Cada comanda aparece uma vez só na divisão.",
  unknown_tab: "Só dá para dividir com comandas abertas desta mesa.",
  wrong_code: "Código errado. Confira com o garçom.",
  wrong_pin: "PIN errado.",
  not_joined: "Entre na mesa com o código do garçom.",
  not_logged_in: "Entre com o PIN da equipe.",
  forbidden: "Você não pode fazer isso.",
  not_found: "Não encontrado.",
  invalid_transition: "Isso não pode ser feito agora.",
  session_closed: "Esta mesa já foi fechada.",
  tab_closed: "Esta comanda não aceita novos pedidos.",
  item_unavailable: "Um dos itens acabou de esgotar.",
  cannot_close: "Ainda há comandas sem pagar.",
  already_open: "Esta mesa já está aberta.",
  unsupported_media_type: "Envie os dados em JSON.",
  locked: "Muitas tentativas. Espere alguns minutos e peça ajuda ao garçom.",
};

export const error = (code: ApiError, extra: Partial<ApiResult> = {}): ApiResult => ({
  status: STATUS[code],
  body: { error: code, message: ERROR_MESSAGES[code] },
  ...extra,
});

export const success = (body: unknown, extra: Partial<ApiResult> = {}): ApiResult => ({
  status: 200,
  body,
  ...extra,
});

/** Converte o resultado do store: valor vira 200, erro vira o status correspondente. */
export const fromResult = <T>(
  result: Result<T>,
  map: (value: T) => unknown = (value) => value,
): ApiResult => (result.ok ? success(map(result.value)) : error(result.error));
