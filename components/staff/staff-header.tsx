"use client";

import { ROLE_LABEL } from "@/components/staff/staff-login";
import { BUTTON } from "@/components/ui/styles";
import type { StaffRole } from "@/lib/api/identity";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/cn";

type Props = {
  role: StaffRole;
  restaurantName: string;
  soundOn: boolean;
  onToggleSound: () => void;
  onLoggedOut: () => void;
};

export const StaffHeader = ({ role, restaurantName, soundOn, onToggleSound, onLoggedOut }: Props) => {
  const logout = async () => {
    await apiRequest("/api/staff/logout", { method: "POST", body: { role } });
    onLoggedOut();
  };

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">{restaurantName}</p>
          <h1 className="text-lg font-bold">{ROLE_LABEL[role]}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(BUTTON.secondary, "min-h-10 px-4 text-sm", soundOn && "border-accent text-accent")}
            aria-pressed={soundOn}
            onClick={onToggleSound}
          >
            {soundOn ? "Som ligado" : "Ligar som"}
          </button>
          <button type="button" className={cn(BUTTON.ghost, "min-h-10 px-4 text-sm")} onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
};
