"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";

export type Account = { id: string; name: string; email: string };

export type AccountState = { status: "loading" } | { status: "guest" } | { status: "signed-in"; account: Account };

const load = async (): Promise<AccountState> => {
  const { data } = await authClient.getSession();
  if (!data?.user) return { status: "guest" };
  const { id, name, email } = data.user;
  return { status: "signed-in", account: { id, name, email } };
};

/** Conta do dono logada neste navegador (sessão do Better Auth, lida só no navegador). */
export const useAccount = () => {
  const [state, setState] = useState<AccountState>({ status: "loading" });

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

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setState({ status: "guest" });
  }, []);

  return { state, refresh, signOut };
};
