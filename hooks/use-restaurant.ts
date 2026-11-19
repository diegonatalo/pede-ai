"use client";

import { createContext, useCallback, useContext } from "react";
import { apiRequest, withRestaurant, type Api, type RequestOptions } from "@/lib/api-client";
import { RESTAURANT } from "@/lib/seed-data";

/** Endereço (slug) do restaurante da tela. Fora de `/r/<slug>/...`, a demonstração. */
export const RestaurantContext = createContext<string>(RESTAURANT.slug);

export const useRestaurantSlug = () => useContext(RestaurantContext);

/** `apiRequest` que fala com o restaurante da tela. */
export const useApi = (): Api => {
  const slug = useRestaurantSlug();
  return useCallback(
    (path: string, options?: RequestOptions) => apiRequest(withRestaurant(path, slug, RESTAURANT.slug), options),
    [slug],
  ) as Api;
};
