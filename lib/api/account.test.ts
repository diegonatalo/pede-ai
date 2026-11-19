import { describe, expect, it } from "vitest";
import {
  createOwnRestaurant,
  enterAsOwner,
  listOwnRestaurants,
  type AccountDeps,
} from "@/lib/api/account";
import type { ApiResult } from "@/lib/api/result";
import { setTeamActive } from "@/lib/api/staff";
import { MAX_RESTAURANTS_PER_OWNER } from "@/lib/restaurant-template";
import { createStore } from "@/lib/store/engine";
import { createMemoryRegistry, createMemoryRepository, createMemoryWorld } from "@/lib/store/memory";

const NOW = Date.parse("2026-11-19T20:00:00.000Z");
const errorOf = (result: ApiResult) => (result.body as { error?: string }).error ?? "ok";

const ANA = { id: "user-ana", name: "Ana" };
const RUI = { id: "user-rui", name: "Rui" };

const setup = () => {
  const world = createMemoryWorld();
  const registry = createMemoryRegistry(world);
  let counter = 0;
  const deps: AccountDeps = {
    registry,
    now: () => new Date(NOW).toISOString(),
    newId: () => `id-${++counter}`,
    newPin: () => "818181",
  };
  const storeFor = (restaurantId: string) =>
    createStore(createMemoryRepository(world, restaurantId), { pinKey: world.pinKey });
  return { registry, deps, storeFor };
};

describe("cadastro do restaurante", () => {
  it("cria o restaurante da conta, com o dono como gerente e o PIN mostrado uma vez", async () => {
    const { deps, registry, storeFor } = setup();
    const created = await createOwnRestaurant(deps, ANA, { name: "  Cantina da Ana ", slug: "cantina-da-ana" });
    expect(created.status).toBe(200);
    const { restaurant, pin } = created.body as { restaurant: { id: string; slug: string; name: string }; pin: string };
    expect(restaurant).toMatchObject({ slug: "cantina-da-ana", name: "Cantina da Ana", ownerUserId: "user-ana" });
    expect(pin).toBe("818181");

    const store = storeFor(restaurant.id);
    expect((await store.getRestaurant()).name).toBe("Cantina da Ana");
    const owner = await store.verifyStaffPin("818181");
    expect(owner.ok && owner.value).toMatchObject({ id: `${restaurant.id}-owner`, name: "Ana", role: "manager" });
    expect((await listOwnRestaurants(registry, ANA)).body).toEqual({ restaurants: [restaurant] });
    expect((await listOwnRestaurants(registry, RUI)).body).toEqual({ restaurants: [] });
  });

  it("recusa nome e endereço inválidos, reservados ou já usados", async () => {
    const { deps } = setup();
    expect(errorOf(await createOwnRestaurant(deps, ANA, { name: "A", slug: "cantina" }))).toBe("invalid_input");
    expect(errorOf(await createOwnRestaurant(deps, ANA, { name: "Cantina" }))).toBe("invalid_input");
    expect(errorOf(await createOwnRestaurant(deps, ANA, { name: "Cantina", slug: "Cantina Zé" }))).toBe("invalid_slug");
    expect(errorOf(await createOwnRestaurant(deps, ANA, { name: "Cantina", slug: "demo" }))).toBe("slug_taken");
    expect(errorOf(await createOwnRestaurant(deps, ANA, { name: "Cantina", slug: "cantina" }))).toBe("ok");
    expect(errorOf(await createOwnRestaurant(deps, RUI, { name: "Outra", slug: "cantina" }))).toBe("slug_taken");
  });

  it(`limita a ${MAX_RESTAURANTS_PER_OWNER} restaurantes por conta`, async () => {
    const { deps } = setup();
    for (let index = 0; index < MAX_RESTAURANTS_PER_OWNER; index++) {
      expect(errorOf(await createOwnRestaurant(deps, ANA, { name: `Casa ${index}`, slug: `casa-${index}` }))).toBe("ok");
    }
    expect(errorOf(await createOwnRestaurant(deps, ANA, { name: "Mais uma", slug: "mais-uma" }))).toBe(
      "too_many_restaurants",
    );
  });
});

describe("dono entra como gerente", () => {
  const withRestaurant = async () => {
    const context = setup();
    const created = await createOwnRestaurant(context.deps, ANA, { name: "Cantina", slug: "cantina" });
    const { restaurant } = created.body as { restaurant: { id: string } };
    return { ...context, restaurantId: restaurant.id };
  };

  it("grava a tela do gerente no cookie, sem PIN, e mantém as outras telas", async () => {
    const { registry, storeFor, restaurantId } = await withRestaurant();
    const before = { seats: { "demo:waiter": { id: "staff-demo-waiter", name: "Garçom da demo" } }, exp: NOW };
    const result = await enterAsOwner(registry, storeFor, ANA, before, { slug: "cantina" }, NOW);
    expect(result.body).toEqual({ slug: "cantina" });
    expect(result.staff?.seats).toEqual({
      "demo:waiter": { id: "staff-demo-waiter", name: "Garçom da demo" },
      [`${restaurantId}:manager`]: { id: `${restaurantId}-owner`, name: "Ana" },
    });
    expect(result.staff?.exp).toBeGreaterThan(NOW);
  });

  it("não deixa outra conta entrar, nem num restaurante que não existe", async () => {
    const { registry, storeFor } = await withRestaurant();
    expect(errorOf(await enterAsOwner(registry, storeFor, RUI, null, { slug: "cantina" }, NOW))).toBe(
      "restaurant_not_found",
    );
    expect(errorOf(await enterAsOwner(registry, storeFor, ANA, null, { slug: "nao-existe" }, NOW))).toBe(
      "restaurant_not_found",
    );
    expect(errorOf(await enterAsOwner(registry, storeFor, ANA, null, { slug: "demo" }, NOW))).toBe(
      "restaurant_not_found",
    );
    expect(errorOf(await enterAsOwner(registry, storeFor, ANA, null, {}, NOW))).toBe("restaurant_not_found");
  });

  it("o dono não pode ser desativado pela equipe", async () => {
    const { storeFor, restaurantId } = await withRestaurant();
    const store = storeFor(restaurantId);
    const owner = { role: "manager" as const, staffId: `${restaurantId}-owner`, name: "Ana" };
    expect(errorOf(await setTeamActive(store, owner, `${restaurantId}-owner`, { active: false }))).toBe("forbidden");
  });
});
