import { isRecord } from "@/lib/api/body";
import { IDENTITY_TTL_MS, seatKey, type StaffIdentity } from "@/lib/api/identity";
import { error, success, type ApiResult } from "@/lib/api/result";
import {
  isReservedSlug,
  isValidSlug,
  MAX_RESTAURANTS_PER_OWNER,
  newRestaurantData,
  ownerStaffIdFor,
} from "@/lib/restaurant-template";
import type { RestaurantRegistry, Store } from "@/types/store";

/** Conta logada (Better Auth): só o que os serviços usam. */
export type AccountUser = { id: string; name: string };

const NAME_MIN = 2;
const NAME_MAX = 60;

export type AccountDeps = {
  registry: RestaurantRegistry;
  now: () => string;
  newId: () => string;
  newPin: () => string;
};

/** Restaurantes da conta. */
export const listOwnRestaurants = async (registry: RestaurantRegistry, user: AccountUser): Promise<ApiResult> =>
  success({ restaurants: await registry.listByOwner(user.id) });

/**
 * Cria o restaurante da conta com o salão e o cardápio de exemplo. O dono entra na equipe como
 * gerente, com um PIN mostrado uma vez só (para entrar pelos aparelhos do restaurante).
 */
export const createOwnRestaurant = async (deps: AccountDeps, user: AccountUser, body: unknown): Promise<ApiResult> => {
  if (!isRecord(body) || typeof body.name !== "string" || typeof body.slug !== "string") return error("invalid_input");
  const name = body.name.trim();
  const slug = body.slug.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return error("invalid_input");
  if (isReservedSlug(slug)) return error("slug_taken");
  if (!isValidSlug(slug)) return error("invalid_slug");
  if ((await deps.registry.listByOwner(user.id)).length >= MAX_RESTAURANTS_PER_OWNER) {
    return error("too_many_restaurants");
  }

  const id = deps.newId();
  const pin = deps.newPin();
  const created = await deps.registry.create(
    newRestaurantData({
      id,
      slug,
      name,
      ownerUserId: user.id,
      owner: { staffId: ownerStaffIdFor(id), name: user.name.trim() || "Dono", pin },
      createdAt: deps.now(),
      newId: deps.newId,
    }),
  );
  if (!created) return error("slug_taken");
  return success({ restaurant: { id, slug, name, ownerUserId: user.id }, pin });
};

/**
 * O dono entra na tela do gerente do próprio restaurante sem digitar o PIN: a conta já prova
 * quem é. Grava a tela no cookie da equipe, como o login com PIN faria.
 */
export const enterAsOwner = async (
  registry: RestaurantRegistry,
  storeFor: (restaurantId: string) => Store,
  user: AccountUser,
  identity: StaffIdentity | null,
  body: unknown,
  nowMs: number,
): Promise<ApiResult> => {
  const slug = isRecord(body) && typeof body.slug === "string" ? body.slug : "";
  const record = slug ? await registry.findBySlug(slug) : null;
  // Restaurante de outra conta responde como inexistente: não confirma que o endereço existe.
  if (!record || record.ownerUserId !== user.id) return error("restaurant_not_found");
  const member = await storeFor(record.id).getStaffMember(ownerStaffIdFor(record.id));
  if (!member?.active) return error("forbidden");
  const seats = { ...(identity?.seats ?? {}), [seatKey(record.id, "manager")]: { id: member.id, name: member.name } };
  return success({ slug: record.slug }, { staff: { seats, exp: nowMs + IDENTITY_TTL_MS } });
};
