"use client";

import { useCallback, useEffect, useState } from "react";
import { useFeed } from "@/hooks/use-feed";
import { useApi } from "@/hooks/use-restaurant";
import type { Api } from "@/lib/api-client";
import type { CustomerView } from "@/lib/views";
import type { Menu } from "@/types/store";

export type CustomerData = { view: CustomerView & { lastSeq: number }; menu: Menu };

type ViewResponse = { state: "guest" } | { state: "closed" } | ({ state: "ready" } & CustomerData["view"]);

export type CustomerState =
  | { status: "loading" }
  /** Ainda não entrou numa mesa (ou o cookie venceu). */
  | { status: "guest" }
  /** A mesa em que estava foi fechada. */
  | { status: "closed" }
  | { status: "ready"; data: CustomerData }
  | { status: "error"; message: string };

/** Lê a mesa e o cardápio e diz qual é o próximo estado, a partir do atual. */
const load = async (apiRequest: Api): Promise<(current: CustomerState) => CustomerState> => {
  const [view, menu] = await Promise.all([apiRequest<ViewResponse>("/api/customer"), apiRequest<Menu>("/api/menu")]);
  if (view.ok && view.data.state === "guest") return () => ({ status: "guest" });
  if (view.ok && view.data.state === "closed") return () => ({ status: "closed" });
  if (view.ok && view.data.state === "ready" && menu.ok) {
    const ready = view.data;
    return () => ({ status: "ready", data: { view: ready, menu: menu.data } });
  }
  const message = (!view.ok ? view.message : !menu.ok ? menu.message : "") || "";
  // Falha momentânea com dados na tela: mantém o que já tem e tenta no próximo ciclo.
  return (current) => (current.status === "ready" ? current : { status: "error", message });
};

/** Mesa e cardápio do cliente, atualizados pelo polling do feed. */
export const useCustomerView = () => {
  const apiRequest = useApi();
  const [state, setState] = useState<CustomerState>({ status: "loading" });

  const refresh = useCallback(async () => {
    setState(await load(apiRequest));
  }, [apiRequest]);

  useEffect(() => {
    // A primeira leitura só acontece no navegador, onde está o cookie do aparelho.
    let active = true;
    void load(apiRequest).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [apiRequest]);

  const lastSeq = state.status === "ready" ? state.data.view.lastSeq : 0;
  useFeed(state.status === "ready" ? "/api/customer/feed" : null, lastSeq, refresh);

  return { state, refresh };
};
