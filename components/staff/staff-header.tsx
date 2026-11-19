"use client";

import { ROLE_LABEL } from "@/components/staff/staff-login";
import { UtensilsIcon } from "@/components/ui/icons";
import { BUTTON, EYEBROW } from "@/components/ui/styles";
import type { StaffRole } from "@/lib/api/identity";
import { useApi } from "@/hooks/use-restaurant";

type Props = {
  role: StaffRole;
  restaurantName: string;
  /** Nome de quem entrou com o PIN nesta tela. */
  personName?: string;
  /** Sem `onToggleSound`, o botão de som não aparece (tela sem avisos sonoros). */
  soundOn?: boolean;
  onToggleSound?: () => void;
  onLoggedOut: () => void;
};

export const StaffHeader = ({ role, restaurantName, personName, soundOn, onToggleSound, onLoggedOut }: Props) => {
  const apiRequest = useApi();
  const logout = async () => {
    await apiRequest("/api/staff/logout", { method: "POST", body: { role } });
    onLoggedOut();
  };

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-lg print:hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-accent text-on-accent shadow-soft" aria-hidden="true">
            <UtensilsIcon className="size-5" strokeWidth={2.1} />
          </span>
          <div>
            <p className={EYEBROW}>{restaurantName}</p>
            <h1 className="text-lg leading-tight font-bold">
              {ROLE_LABEL[role]}
              {personName && <span className="font-normal text-muted"> · {personName}</span>}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleSound && (
            <button
              type="button"
              className={soundOn ? BUTTON.smallPrimary : BUTTON.small}
              aria-pressed={soundOn}
              onClick={onToggleSound}
            >
              {soundOn ? "Som ligado" : "Ligar som"}
            </button>
          )}
          <button type="button" className={BUTTON.smallGhost} onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
};
