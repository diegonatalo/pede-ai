"use client";

import { useCallback, useState } from "react";
import type { StaffRole } from "@/lib/api/identity";
import { apiRequest } from "@/lib/api-client";

/**
 * Executa comandos da equipe (`POST` com `?role=`), relê a tela e guarda a mensagem de erro.
 * `busy` diz qual botão está em andamento (pela chave passada em `run`).
 */
export const useStaffCommand = (role: StaffRole, refresh: () => Promise<void>) => {
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
    },
    [role, refresh],
  );

  return { busy, message, run };
};
