"use client";

import { createContext, useCallback, useContext } from "react";
import { apiRequest, withRestaurant, type Api, type RequestOptions } from "@/lib/api-client";

/** Endereço (slug) do restaurante da tela, vindo de `/r/<slug>/...`. */
export const RestaurantContext = createContext<string>("");

export const useRestaurantSlug = () => useContext(RestaurantContext);

/** `apiRequest` que fala com o restaurante da tela. */
export const useApi = (): Api => {
  const slug = useRestaurantSlug();
  return useCallback(
    (path: string, options?: RequestOptions) => apiRequest(withRestaurant(path, slug), options),
    [slug],
  ) as Api;
};
