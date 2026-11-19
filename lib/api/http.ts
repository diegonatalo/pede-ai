import { NextResponse, type NextRequest } from "next/server";
import { readSessionSecret } from "@/lib/api/config";
import {
  parseCustomerIdentity,
  parseStaffIdentity,
  type CustomerIdentity,
  type StaffIdentity,
  type StaffActor,
  type StaffRole,
} from "@/lib/api/identity";
import { error, type ApiResult } from "@/lib/api/result";
import { resolveStaffActor } from "@/lib/api/staff";
import { signToken, verifyToken } from "@/lib/signed-token";
import { getStore } from "@/lib/store";

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

/** Rota do cliente: identidade pelo cookie do aparelho. */
export const handleCustomer = async (
  request: NextRequest,
  run: (identity: CustomerIdentity | null, body: unknown) => Promise<ApiResult> | ApiResult,
  { json = request.method !== "GET" }: Options = {},
) => {
  let body: unknown;
  if (json) {
    const parsed = await readJson(request);
    if (!parsed.ok) return respond(parsed.result);
    body = parsed.body;
  }
  return respond(await run(await readCustomer(request), body));
};

/** Rota de login da equipe: mexe no cookie da equipe sem exigir papel. */
export const handleStaffSession = async (
  request: NextRequest,
  run: (identity: StaffIdentity | null, body: unknown) => Promise<ApiResult> | ApiResult,
  { json = request.method !== "GET" }: Options = {},
) => {
  let body: unknown;
  if (json) {
    const parsed = await readJson(request);
    if (!parsed.ok) return respond(parsed.result);
    body = parsed.body;
  }
  return respond(await run(await readStaff(request), body));
};

/**
 * Rota da equipe: a tela vem de `?role=`, e alguém da equipe precisa ter entrado nela com PIN
 * e continuar ativo (quem foi desativado perde o acesso na hora, não quando o cookie vence).
 */
export const handleStaff = async (
  request: NextRequest,
  run: (actor: StaffActor, body: unknown) => Promise<ApiResult> | ApiResult,
  options: Options = {},
) =>
  handleStaffSession(
    request,
    async (identity, body) => {
      const actor = resolveStaffActor(identity, request.nextUrl.searchParams.get("role"));
      if ("status" in (actor as object)) return actor as ApiResult;
      const resolved = actor as Exclude<StaffActor, string>;
      const member = await getStore().getStaffMember(resolved.staffId);
      if (!member?.active) return error("not_logged_in", { staff: withoutSeat(identity, resolved.role) });
      return run(resolved, body);
    },
    options,
  );

/** Tira uma tela do cookie da equipe (`null` apaga o cookie se não sobrar nenhuma). */
const withoutSeat = (identity: StaffIdentity | null, role: StaffRole): StaffIdentity | null => {
  if (!identity) return null;
  const seats = { ...identity.seats };
  delete seats[role];
  return Object.keys(seats).length > 0 ? { seats, exp: identity.exp } : null;
};
