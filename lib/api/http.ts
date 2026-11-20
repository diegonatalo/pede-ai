import { NextResponse, type NextRequest } from "next/server";
import type { AccountUser } from "@/lib/api/account";
import { readSessionSecret } from "@/lib/api/config";
import {
  parseCustomerIdentity,
  parseStaffIdentity,
  type CustomerIdentity,
  type StaffIdentity,
  seatKey,
  type StaffActor,
} from "@/lib/api/identity";
import { error, type ApiResult } from "@/lib/api/result";
import { resolveStaffActor } from "@/lib/api/staff";
import { getAuth } from "@/lib/auth/server";
import { signToken, verifyToken } from "@/lib/signed-token";
import { getRegistry, getStore } from "@/lib/store";
import type { Store } from "@/types/store";

/** Ponte entre os Route Handlers e os serviços de `lib/api`: cookies, JSON e respostas. */

export const CUSTOMER_COOKIE = "pede-ai-customer";
export const STAFF_COOKIE = "pede-ai-staff";

const secret = () => readSessionSecret(process.env);

const readCustomer = async (request: NextRequest) =>
  parseCustomerIdentity(await verifyToken(request.cookies.get(CUSTOMER_COOKIE)?.value, secret()), Date.now());

const readStaff = async (request: NextRequest) =>
  parseStaffIdentity(await verifyToken(request.cookies.get(STAFF_COOKIE)?.value, secret()), Date.now());

/**
 * Lê o corpo em JSON. Exigir `application/json` impede que um formulário de outro site
 * faça a requisição com os cookies da pessoa (o navegador não manda JSON sem CORS).
 */
const readJson = async (request: Request): Promise<{ ok: true; body: unknown } | { ok: false; result: ApiResult }> => {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return { ok: false, result: error("unsupported_media_type") };
  const text = await request.text();
  if (!text) return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, result: error("invalid_input") };
  }
};

const setCookie = async (
  response: NextResponse,
  name: string,
  value: CustomerIdentity | StaffIdentity | null,
) => {
  if (value === null) {
    response.cookies.delete(name);
    return;
  }
  response.cookies.set(name, await signToken(value, secret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(value.exp),
  });
};

export const respond = async (result: ApiResult) => {
  const response = NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
  if (result.customer !== undefined) await setCookie(response, CUSTOMER_COOKIE, result.customer);
  if (result.staff !== undefined) await setCookie(response, STAFF_COOKIE, result.staff);
  return response;
};

type Options = { json?: boolean };

/** Restaurante da requisição e a camada de dados dele. */
export type RequestRestaurant = { id: string; store: Store };

/** Restaurante pedido em `?r=<slug>`. `null` sem o parâmetro ou se ele não existe. */
export const resolveRestaurant = async (request: NextRequest): Promise<RequestRestaurant | null> => {
  const slug = request.nextUrl.searchParams.get("r");
  if (!slug) return null;
  // Sem cache: um restaurante apagado precisa sumir em todas as instâncias na hora.
  const found = await getRegistry().findBySlug(slug);
  if (!found) return null;
  const { id } = found;
  return { id, store: getStore(id) };
};

/** Corpo em JSON quando o método manda corpo; senão, nada. */
const readBody = async (request: NextRequest, json: boolean) => {
  if (!json) return { ok: true as const, body: undefined as unknown };
  return readJson(request);
};

/** Rota pública (cardápio, mesa): só o restaurante. */
export const handlePublic = async (
  request: NextRequest,
  run: (store: Store) => Promise<ApiResult> | ApiResult,
) => {
  const restaurant = await resolveRestaurant(request);
  if (!restaurant) return respond(error("restaurant_not_found"));
  return respond(await run(restaurant.store));
};

/** Rota do cliente: identidade pelo cookie do aparelho, dentro do restaurante pedido. */
export const handleCustomer = async (
  request: NextRequest,
  run: (identity: CustomerIdentity | null, body: unknown, store: Store) => Promise<ApiResult> | ApiResult,
  { json = request.method !== "GET" }: Options = {},
) => {
  const parsed = await readBody(request, json);
  if (!parsed.ok) return respond(parsed.result);
  const restaurant = await resolveRestaurant(request);
  if (!restaurant) return respond(error("restaurant_not_found"));
  // Mesa de outro restaurante não existe no store deste: o serviço trata como "não entrou".
  return respond(await run(await readCustomer(request), parsed.body, restaurant.store));
};

/** Rota de login da equipe: mexe no cookie da equipe sem exigir papel. */
export const handleStaffSession = async (
  request: NextRequest,
  run: (identity: StaffIdentity | null, body: unknown, restaurant: RequestRestaurant) => Promise<ApiResult> | ApiResult,
  { json = request.method !== "GET" }: Options = {},
) => {
  const parsed = await readBody(request, json);
  if (!parsed.ok) return respond(parsed.result);
  const restaurant = await resolveRestaurant(request);
  if (!restaurant) return respond(error("restaurant_not_found"));
  return respond(await run(await readStaff(request), parsed.body, restaurant));
};

/**
 * Rota da equipe: a tela vem de `?role=`, e alguém da equipe precisa ter entrado nela com PIN,
 * neste restaurante, e continuar ativo (quem foi desativado perde o acesso na hora).
 */
export const handleStaff = async (
  request: NextRequest,
  run: (actor: StaffActor, body: unknown, store: Store) => Promise<ApiResult> | ApiResult,
  options: Options = {},
) =>
  handleStaffSession(
    request,
    async (identity, body, restaurant) => {
      const actor = resolveStaffActor(identity, request.nextUrl.searchParams.get("role"), restaurant.id);
      if ("status" in (actor as object)) return actor as ApiResult;
      const resolved = actor as Exclude<StaffActor, string>;
      const member = await restaurant.store.getStaffMember(resolved.staffId);
      if (!member?.active) {
        return error("not_logged_in", { staff: withoutSeat(identity, seatKey(restaurant.id, resolved.role)) });
      }
      return run(resolved, body, restaurant.store);
    },
    options,
  );

/**
 * Rota da conta do dono (Better Auth). Lê também o cookie da equipe, que a entrada como gerente
 * atualiza. Sem conta logada: 401 `not_signed_in`.
 */
export const handleAccount = async (
  request: NextRequest,
  run: (user: AccountUser, body: unknown, staff: StaffIdentity | null) => Promise<ApiResult> | ApiResult,
  { json = request.method !== "GET" }: Options = {},
) => {
  const parsed = await readBody(request, json);
  if (!parsed.ok) return respond(parsed.result);
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) return respond(error("not_signed_in"));
  const user = { id: session.user.id, name: session.user.name };
  return respond(await run(user, parsed.body, await readStaff(request)));
};

/** Tira uma tela do cookie da equipe (`null` apaga o cookie se não sobrar nenhuma). */
const withoutSeat = (identity: StaffIdentity | null, key: string): StaffIdentity | null => {
  if (!identity) return null;
  const seats = { ...identity.seats };
  delete seats[key];
  return Object.keys(seats).length > 0 ? { seats, exp: identity.exp } : null;
};
