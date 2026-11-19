"use client";

import { useCallback, useEffect, useState } from "react";
import { useFeed } from "@/hooks/use-feed";
import type { StaffRole } from "@/lib/api/identity";
import { useApi } from "@/hooks/use-restaurant";
import type { Api } from "@/lib/api-client";
import type { Restaurant, Table } from "@/types/domain";
import type { Menu, SessionSnapshot } from "@/types/store";

export type StaffOverview = {
  tables: Table[];
  sessions: SessionSnapshot[];
  menu: Menu;
  restaurant: Restaurant;
  joinCodes: Record<string, string>;
  lastSeq: number;
  /** Quem está nesta tela (nulo só em testes antigos). */
  me: { name: string; role: StaffRole; staffId: string } | null;
};

export type StaffState =
  | { status: "loading" }
  /** Ainda não entrou com o PIN deste papel neste navegador. */
  | { status: "login" }
  | { status: "ready"; data: StaffOverview }
  | { status: "error"; message: string };

const load = async (apiRequest: Api, role: StaffRole): Promise<(current: StaffState) => StaffState> => {
  // `me` responde sempre 200: perguntar antes evita um 401 no console de quem não entrou.
  const me = await apiRequest<{ roles: string[] }>("/api/staff/me");
  if (me.ok && !me.data.roles.includes(role)) return () => ({ status: "login" });
  const overview = await apiRequest<StaffOverview>(`/api/staff/overview?role=${role}`);
  if (overview.ok) return () => ({ status: "ready", data: overview.data });
  if (overview.error === "not_logged_in") return () => ({ status: "login" });
  const message = !me.ok ? me.message : overview.message;
  // Falha momentânea com dados na tela: mantém e tenta no próximo ciclo.
  return (current) => (current.status === "ready" ? current : { status: "error", message });
};

/** Mesas abertas, cardápio e configuração para a tela de um papel da equipe, com polling. */
export const useStaffOverview = (role: StaffRole) => {
  const apiRequest = useApi();
  const [state, setState] = useState<StaffState>({ status: "loading" });

  const refresh = useCallback(async () => {
    setState(await load(apiRequest, role));
  }, [apiRequest, role]);

  useEffect(() => {
    let active = true;
    void load(apiRequest, role).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [apiRequest, role]);

  const lastSeq = state.status === "ready" ? state.data.lastSeq : 0;
  useFeed(state.status === "ready" ? `/api/staff/feed?role=${role}` : null, lastSeq, refresh);

  return { state, refresh };
};
