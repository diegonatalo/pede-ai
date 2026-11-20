"use client";

import { BellIcon } from "@/components/ui/icons";
import { BUTTON } from "@/components/ui/styles";
import { usePush } from "@/hooks/use-push";
import type { StaffRole } from "@/types/domain";

/**
 * Liga os avisos no celular (pedido para confirmar, item pronto, chamado), mesmo com a tela
 * apagada. Some quando o aparelho ou o servidor não tem como receber avisos.
 */
export const PushToggle = ({ role }: { role: StaffRole }) => {
  const { state, message, enable, disable } = usePush(role);

  if (state === "loading" || state === "unsupported" || state === "unavailable") return null;

  if (state === "denied") {
    return (
      <span className="text-xs text-muted" role="status">
        Avisos bloqueados no navegador
      </span>
    );
  }

  const on = state === "on";
  return (
    <>
      <button
        type="button"
        className={on ? BUTTON.smallPrimary : BUTTON.small}
        aria-pressed={on}
        disabled={state === "busy"}
        onClick={() => void (on ? disable() : enable())}
        title={on ? "Desligar os avisos neste aparelho" : "Receber avisos neste aparelho, mesmo com a tela apagada"}
      >
        <BellIcon className="size-4" />
        {on ? "Avisos ligados" : "Ligar avisos"}
      </button>
      {message && (
        <span className="text-xs text-danger" role="alert">
          {message}
        </span>
      )}
    </>
  );
};
