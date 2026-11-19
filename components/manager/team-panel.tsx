"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ROLE_LABEL } from "@/components/staff/staff-login";
import { BUTTON, CARD, INPUT, LABEL, SELECT } from "@/components/ui/styles";
import { useApi } from "@/hooks/use-restaurant";
import { cn } from "@/lib/cn";
import { ownerStaffIdFor } from "@/lib/restaurant-template";
import type { StaffMember, StaffRole } from "@/types/domain";

type Props = {
  /** Pessoa que está usando a tela do gerente (não pode desativar a si mesma). */
  meId?: string;
};

type NewPin = { name: string; pin: string };

const ROLES: StaffRole[] = ["waiter", "kitchen", "manager"];

/**
 * Equipe do restaurante: cadastrar quem trabalha, ver o PIN gerado uma vez só, trocar o PIN
 * e desativar quem saiu. A equipe da demonstração aparece, mas não pode ser alterada.
 */
export const TeamPanel = ({ meId }: Props) => {
  const apiRequest = useApi();
  const [team, setTeam] = useState<StaffMember[] | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("waiter");
  const [newPin, setNewPin] = useState<NewPin | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await apiRequest<StaffMember[]>("/api/staff/team?role=manager");
    if (response.ok) setTeam(response.data);
    else setMessage(response.message);
  }, [apiRequest]);

  useEffect(() => {
    let active = true;
    void apiRequest<StaffMember[]>("/api/staff/team?role=manager").then((response) => {
      if (!active) return;
      if (response.ok) setTeam(response.data);
      else setMessage(response.message);
    });
    return () => {
      active = false;
    };
  }, [apiRequest]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("novo");
    setMessage("");
    const response = await apiRequest<{ member: StaffMember; pin: string }>("/api/staff/team?role=manager", {
      method: "POST",
      body: { name, role },
    });
    setBusy(null);
    if (!response.ok) {
      setMessage(response.message);
      return;
    }
    setNewPin({ name: response.data.member.name, pin: response.data.pin });
    setName("");
    await load();
  };

  const resetPin = async (member: StaffMember) => {
    setBusy(member.id);
    setMessage("");
    const response = await apiRequest<{ pin: string }>(`/api/staff/team/${member.id}/pin?role=manager`, {
      method: "POST",
    });
    setBusy(null);
    if (response.ok) setNewPin({ name: member.name, pin: response.data.pin });
    else setMessage(response.message);
  };

  const setActive = async (member: StaffMember, active: boolean) => {
    setBusy(member.id);
    setMessage("");
    const response = await apiRequest(`/api/staff/team/${member.id}/active?role=manager`, {
      method: "POST",
      body: { active },
    });
    setBusy(null);
    if (!response.ok) setMessage(response.message);
    await load();
  };

  return (
    <div className="flex flex-col gap-6">
      {newPin && (
        <section
          className="flex flex-col gap-2 rounded-2xl border-2 border-accent bg-card p-5"
          role="status"
          aria-label={`PIN de ${newPin.name}`}
        >
          <p className="font-semibold">PIN de {newPin.name}</p>
          <p className="font-mono text-4xl font-bold tracking-[0.3em]">{newPin.pin}</p>
          <p className="text-sm text-muted">
            Anote e entregue à pessoa: o PIN não aparece de novo. Se perder, gere outro.
          </p>
          <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => setNewPin(null)}>
            Já anotei
          </button>
        </section>
      )}

      <form onSubmit={create} className={`${CARD} flex flex-col gap-4 p-5 sm:flex-row sm:items-end`}>
        <label className="flex flex-1 flex-col gap-2">
          <span className={LABEL}>Nome</span>
          <input className={INPUT} required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>Papel</span>
          <select
            className={SELECT}
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
          >
            {ROLES.map((entry) => (
              <option key={entry} value={entry}>
                {ROLE_LABEL[entry]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={BUTTON.primary} disabled={busy === "novo" || !name.trim()}>
          Cadastrar
        </button>
      </form>

      {message && (
        <p className="rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger" role="alert">
          {message}
        </p>
      )}

      {!team ? (
        <p className="text-muted" role="status">
          Carregando a equipe…
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Equipe">
          {team.map((member) => (
            <li key={member.id} className={cn(CARD, "flex flex-col gap-3 p-4", !member.active && "opacity-70")}>
              <div>
                <p className="font-semibold">{member.name}</p>
                <p className="text-sm text-muted">
                  {ROLE_LABEL[member.role]}
                  {!member.active && " · desativado"}
                  {member.system && " · demonstração"}
                  {member.id === ownerStaffIdFor(member.restaurantId) && " · dono"}
                </p>
              </div>
              {member.system ? (
                <p className="text-sm text-muted">PIN público da demo; não pode ser alterado.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {member.active && (
                    <button
                      type="button"
                      className={BUTTON.small}
                      disabled={busy === member.id}
                      onClick={() => void resetPin(member)}
                      aria-label={`Gerar outro PIN para ${member.name}`}
                    >
                      Novo PIN
                    </button>
                  )}
                  {member.id !== meId && member.id !== ownerStaffIdFor(member.restaurantId) && (
                    <button
                      type="button"
                      className={BUTTON.smallGhost}
                      disabled={busy === member.id}
                      onClick={() => void setActive(member, !member.active)}
                      aria-label={`${member.active ? "Desativar" : "Reativar"} ${member.name}`}
                    >
                      {member.active ? "Desativar" : "Reativar"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
