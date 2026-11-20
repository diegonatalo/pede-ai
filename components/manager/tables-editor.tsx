"use client";

import { useState, type FormEvent } from "react";
import { BADGE, BUTTON, CARD, INPUT, LABEL } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { FLOOR_LIMITS, type FloorChange } from "@/lib/floor-editor";
import type { Table } from "@/types/domain";

type Props = {
  tables: Table[];
  /** Mesas abertas agora (não dá para tirar do salão). */
  openTableIds: Set<string>;
  busy: string | null;
  run: (key: string, path: string, body?: unknown) => Promise<boolean>;
};

type Open = { kind: "rename"; id: string } | { kind: "archive"; id: string } | null;

/** Mesas do salão: criar, renomear, mudar a ordem e tirar do salão. */
export const TablesEditor = ({ tables, openTableIds, busy, run }: Props) => {
  const [open, setOpen] = useState<Open>(null);
  const change = (key: string, body: FloorChange) => run(key, "/api/staff/floor", body);

  return (
    <div className="flex flex-col gap-4">
      {tables.length === 0 ? (
        <p className="text-muted">Nenhuma mesa ainda. Cadastre a primeira abaixo.</p>
      ) : (
        <ul className={cn(CARD, "flex flex-col divide-y divide-border px-4")} aria-label="Mesas">
          {tables.map((table, index) => {
            const inUse = openTableIds.has(table.id);
            return (
              <li key={table.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                {open?.kind === "rename" && open.id === table.id ? (
                  <RenameTable
                    table={table}
                    busy={busy === table.id}
                    onSubmit={async (label) => {
                      if (await change(table.id, { type: "save_table", id: table.id, label })) setOpen(null);
                    }}
                    onCancel={() => setOpen(null)}
                  />
                ) : (
                  <>
                    <p className="font-semibold">
                      {table.label}
                      {inUse && <span className={cn(BADGE.accent, "ml-2")}>aberta</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={BUTTON.small}
                        disabled={index === 0 || busy === table.id}
                        onClick={() => void change(table.id, { type: "move_table", id: table.id, direction: "up" })}
                        aria-label={`Subir ${table.label}`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={BUTTON.small}
                        disabled={index === tables.length - 1 || busy === table.id}
                        onClick={() => void change(table.id, { type: "move_table", id: table.id, direction: "down" })}
                        aria-label={`Descer ${table.label}`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={BUTTON.smallGhost}
                        onClick={() => setOpen({ kind: "rename", id: table.id })}
                        aria-label={`Renomear ${table.label}`}
                      >
                        Renomear
                      </button>
                      {open?.kind === "archive" && open.id === table.id ? (
                        <>
                          <button
                            type="button"
                            className={BUTTON.smallDanger}
                            disabled={busy === table.id}
                            onClick={() =>
                              void change(table.id, { type: "archive_table", id: table.id }).then((ok) => ok && setOpen(null))
                            }
                            aria-label={`Confirmar: tirar ${table.label} do salão`}
                          >
                            Confirmar
                          </button>
                          <button type="button" className={BUTTON.smallGhost} onClick={() => setOpen(null)}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={BUTTON.smallGhost}
                          disabled={inUse}
                          title={inUse ? "Feche a mesa antes de tirá-la do salão." : undefined}
                          onClick={() => setOpen({ kind: "archive", id: table.id })}
                          aria-label={`Tirar ${table.label} do salão`}
                        >
                          Tirar do salão
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm text-muted">
        Mesa tirada do salão some das telas e do QR code, mas continua nos números dos dias em que foi usada.
      </p>
      {tables.length < FLOOR_LIMITS.tables && <NewTable busy={busy === "nova-mesa"} change={change} />}
    </div>
  );
};

const RenameTable = ({
  table,
  busy,
  onSubmit,
  onCancel,
}: {
  table: Table;
  busy: boolean;
  onSubmit: (label: string) => Promise<void>;
  onCancel: () => void;
}) => {
  const [label, setLabel] = useState(table.label);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(label.trim());
  };
  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:flex-row sm:items-end" aria-label={`Renomear ${table.label}`}>
      <label className="flex flex-1 flex-col gap-1">
        <span className={LABEL}>Nome da mesa</span>
        <input
          className={INPUT}
          required
          maxLength={FLOOR_LIMITS.tableLabel}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <button type="submit" className={BUTTON.primary} disabled={busy || !label.trim()}>
        Salvar
      </button>
      <button type="button" className={BUTTON.ghost} onClick={onCancel}>
        Cancelar
      </button>
    </form>
  );
};

const NewTable = ({ busy, change }: { busy: boolean; change: (key: string, body: FloorChange) => Promise<boolean> }) => {
  const [label, setLabel] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await change("nova-mesa", { type: "save_table", label: label.trim() })) setLabel("");
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end" aria-label="Nova mesa">
      <label className="flex flex-1 flex-col gap-1">
        <span className={LABEL}>Nova mesa</span>
        <input
          className={INPUT}
          required
          maxLength={FLOOR_LIMITS.tableLabel}
          placeholder="Ex.: Mesa 9 ou Varanda 2"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <button type="submit" className={BUTTON.primary} disabled={busy || !label.trim()}>
        Criar mesa
      </button>
    </form>
  );
};
