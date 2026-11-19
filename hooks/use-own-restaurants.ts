"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { RestaurantRecord } from "@/types/store";

export type OwnRestaurantsState =
  | { status: "loading" }
  | { status: "ready"; restaurants: RestaurantRecord[] }
  | { status: "error"; message: string };

const load = async (): Promise<OwnRestaurantsState> => {
  const response = await apiRequest<{ restaurants: RestaurantRecord[] }>("/api/account/restaurants");
  return response.ok
    ? { status: "ready", restaurants: response.data.restaurants }
    : { status: "error", message: response.message };
};

/** Restaurantes da conta logada. */
export const useOwnRestaurants = () => {
  const [state, setState] = useState<OwnRestaurantsState>({ status: "loading" });

  const refresh = useCallback(async () => {
    setState(await load());
  }, []);

  useEffect(() => {
    let active = true;
    void load().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return { state, refresh };
};
