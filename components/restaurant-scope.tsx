"use client";

import { useParams } from "next/navigation";
import { RestaurantContext } from "@/hooks/use-restaurant";

/** Prende as telas de `/r/<slug>/...` ao restaurante do endereço. Pede `<Suspense>` em volta. */
export const RestaurantScope = ({ children }: { children: React.ReactNode }) => {
  const { slug } = useParams<{ slug: string }>();
  return <RestaurantContext value={decodeURIComponent(slug)}>{children}</RestaurantContext>;
};
