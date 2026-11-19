"use client";

import { useCallback, useState } from "react";
import type { StaffRole } from "@/lib/api/identity";
import { useApi } from "@/hooks/use-restaurant";

/**
 * Executa comandos da equipe (`POST` com `?role=`), relê a tela e guarda a mensagem de erro.
 * `busy` diz qual botão está em andamento (pela chave passada em `run`), e `run` diz se deu certo.
 */
export const useStaffCommand = (role: StaffRole, refresh: () => Promise<void>) => {
  const apiRequest = useApi();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const run = useCallback(
    async (key: string, path: string, body: unknown = {}) => {
      setBusy(key);
      setMessage("");
      const response = await apiRequest(`${path}?role=${role}`, { method: "POST", body });
      setBusy(null);
      if (!response.ok) setMessage(response.message);
      await refresh();
      return response.ok;
    },
    [apiRequest, role, refresh],
  );

  return { busy, message, run };
};
