import type { CustomerIdentity, StaffIdentity } from "@/lib/api/identity";
import type { Result, StoreError } from "@/types/store";

export type ApiError =
  | StoreError
  | "unsupported_media_type"
  | "not_joined"
  | "not_logged_in"
  | "wrong_pin"
  | "wrong_screen"
  | "restaurant_not_found"
  | "not_signed_in"
  | "invalid_slug"
  | "slug_taken"
  | "too_many_restaurants";

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
  invalid_slug: 400,
  not_signed_in: 401,
  slug_taken: 409,
  too_many_restaurants: 409,
  empty: 400,
  invalid_parts: 400,
  duplicate_tab: 400,
  unknown_tab: 400,
  wrong_code: 401,
  wrong_pin: 401,
  not_joined: 401,
  not_logged_in: 401,
  forbidden: 403,
  wrong_screen: 403,
  not_found: 404,
  restaurant_not_found: 404,
  invalid_transition: 409,
  session_closed: 409,
  tab_closed: 409,
  item_unavailable: 409,
  cannot_close: 409,
  already_open: 409,
  category_not_empty: 409,
  duplicate_label: 409,
  floor_full: 409,
  table_in_use: 409,
  menu_full: 409,
  conflict: 409,
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
  wrong_screen: "Este PIN não dá acesso a esta tela. Use a tela do seu papel.",
  not_joined: "Entre na mesa com o código do garçom.",
  not_logged_in: "Entre com o PIN da equipe.",
  forbidden: "Você não pode fazer isso.",
  not_found: "Não encontrado.",
  restaurant_not_found: "Restaurante não encontrado. Confira o endereço.",
  not_signed_in: "Entre na sua conta para continuar.",
  invalid_slug: "O endereço usa de 3 a 40 letras minúsculas, números e hífens (ex.: cantina-do-ze).",
  slug_taken: "Esse endereço já está em uso. Escolha outro.",
  too_many_restaurants: "Cada conta pode ter até 3 restaurantes por enquanto.",
  invalid_transition: "Isso não pode ser feito agora.",
  session_closed: "Esta mesa já foi fechada.",
  tab_closed: "Esta comanda não aceita novos pedidos.",
  item_unavailable: "Um dos itens acabou de esgotar.",
  cannot_close: "Ainda há comandas sem pagar.",
  already_open: "Esta mesa já está aberta.",
  category_not_empty: "Mova ou exclua os itens da categoria antes de excluí-la.",
  duplicate_label: "Já existe uma mesa com esse nome.",
  floor_full: "O salão chegou ao limite de 100 mesas ou 150 pontos no mapa.",
  table_in_use: "Esta mesa está aberta. Feche a mesa antes de tirá-la do salão.",
  menu_full: "O cardápio chegou ao limite de 30 categorias ou 300 itens.",
  conflict: "Outra pessoa mexeu nesta mesa ao mesmo tempo. Tente de novo.",
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
