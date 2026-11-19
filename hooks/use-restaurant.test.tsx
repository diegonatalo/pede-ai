import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RestaurantContext, useApi, useRestaurantSlug } from "@/hooks/use-restaurant";

afterEach(() => {
  vi.restoreAllMocks();
});

const inRestaurant = (slug: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <RestaurantContext value={slug}>{children}</RestaurantContext>;
  };

describe("useRestaurantSlug", () => {
  it("é a demonstração fora de /r/<slug>", () => {
    expect(renderHook(() => useRestaurantSlug()).result.current).toBe("demo");
  });
});

describe("useApi", () => {
  it("chama a API do restaurante da tela", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({}));
    const { result } = renderHook(() => useApi(), { wrapper: inRestaurant("cantina") });
    await result.current("/api/staff/overview?role=waiter");
    expect(spy.mock.calls[0][0]).toBe("/api/staff/overview?role=waiter&r=cantina");
  });

  it("não muda de identidade entre renderizações (efeitos não disparam à toa)", () => {
    const { result, rerender } = renderHook(() => useApi(), { wrapper: inRestaurant("cantina") });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
