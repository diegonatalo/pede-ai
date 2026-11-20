"use client";

import { useState } from "react";
import { BUTTON, CARD, LABEL, SELECT } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { FLOOR_LIMITS, shortTableLabel, type FloorChange, type SpotInput } from "@/lib/floor-editor";
import { describePosition, SPOT_KIND_LABEL } from "@/lib/map";
import type { MapSpot, MapSpotKind, Table } from "@/types/domain";

type Props = {
  tables: Table[];
  spots: MapSpot[];
  busy: boolean;
  run: (key: string, path: string, body?: unknown) => Promise<boolean>;
};

/** Ponto em edição: `key` identifica na tela; `id` só existe nos pontos que já estão salvos. */
type Draft = SpotInput & { key: string };

const STEP = 2;
const LANDMARKS: MapSpotKind[] = ["kitchen", "bar", "restroom", "cashier", "entrance"];

const FILL: Record<MapSpotKind, string> = {
  table: "fill-card stroke-border",
  kitchen: "fill-warning-soft stroke-warning/60",
  bar: "fill-accent-soft stroke-accent/60",
  restroom: "fill-info-soft stroke-info/60",
  cashier: "fill-success-soft stroke-success/60",
  entrance: "fill-transparent stroke-muted",
};

const toDraft = (spot: MapSpot): Draft => ({
  key: spot.id,
  id: spot.id,
  kind: spot.kind,
  label: spot.label,
  ...(spot.tableId && { tableId: spot.tableId }),
  x: spot.x,
  y: spot.y,
  w: spot.w,
  h: spot.h,
});

/** O que vai para o servidor (sem a chave da tela). */
const toInput = ({ id, kind, label, tableId, x, y, w, h }: Draft): SpotInput => ({
  ...(id && { id }),
  kind,
  ...(label !== undefined && { label }),
  ...(tableId && { tableId }),
  x,
  y,
  w,
  h,
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Editor do mapa do salão numa grade de 100 × 100 (fundo em cima, entrada embaixo).
 * Mexe no aparelho e salva de uma vez. Tudo funciona por botões (teclado e leitor de tela);
 * clicar no desenho só escolhe o ponto.
 */
export const MapEditor = ({ tables, spots, busy, run }: Props) => {
  const [draft, setDraft] = useState<Draft[]>(() => spots.map(toDraft));
  const [selected, setSelected] = useState<string | null>(null);
  const [counter, setCounter] = useState(0);
  const [adding, setAdding] = useState("");

  const tableLabel = new Map(tables.map((table) => [table.id, table.label]));
  const nameOf = (spot: Draft) =>
    spot.kind === "table" ? (tableLabel.get(spot.tableId ?? "") ?? "Mesa") : SPOT_KIND_LABEL[spot.kind];
  const placed = new Set(draft.map((spot) => spot.tableId).filter(Boolean));
  const unplaced = tables.filter((table) => !placed.has(table.id));
  const current = draft.find((spot) => spot.key === selected) ?? null;
  const dirty = JSON.stringify(draft.map(toInput)) !== JSON.stringify(spots.map((spot) => toInput(toDraft(spot))));

  const update = (key: string, patch: (spot: Draft) => Partial<Draft>) =>
    setDraft((list) => list.map((spot) => (spot.key === key ? { ...spot, ...patch(spot) } : spot)));

  const move = (dx: number, dy: number) =>
    current &&
    update(current.key, (spot) => ({
      x: clamp(spot.x + dx, 0, 100 - spot.w),
      y: clamp(spot.y + dy, 0, 100 - spot.h),
    }));

  const resize = (dw: number, dh: number) =>
    current &&
    update(current.key, (spot) => {
      const w = clamp(spot.w + dw, FLOOR_LIMITS.minSize, 100 - spot.x);
      const h = clamp(spot.h + dh, FLOOR_LIMITS.minSize, 100 - spot.y);
      return { w, h };
    });

  const add = () => {
    if (!adding) return;
    const key = `novo-${counter}`;
    setCounter((value) => value + 1);
    const [kind, tableId] = adding.split(":") as [MapSpotKind, string | undefined];
    const spot: Draft = {
      key,
      kind,
      ...(tableId && { tableId, label: shortTableLabel(tableLabel.get(tableId) ?? "") }),
      x: 44,
      y: 44,
      w: kind === "table" ? 12 : 20,
      h: kind === "table" ? 12 : 12,
    };
    setDraft((list) => [...list, spot]);
    setSelected(key);
    setAdding("");
  };

  const save = async () => {
    const body: FloorChange = { type: "save_map", spots: draft.map(toInput) };
    await run("mapa", "/api/staff/floor", body);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <svg
          viewBox="-1 -1 102 102"
          className="w-full rounded-2xl border border-border bg-background"
          aria-hidden="true"
        >
          {/* Grade de fundo, a cada 10 unidades. */}
          {Array.from({ length: 9 }, (_, index) => (index + 1) * 10).map((line) => (
            <g key={line} className="stroke-border" strokeWidth={0.15}>
              <line x1={line} y1={0} x2={line} y2={100} />
              <line x1={0} y1={line} x2={100} y2={line} />
            </g>
          ))}
          {draft.map((spot) => {
            const active = spot.key === selected;
            const isTable = spot.kind === "table";
            return (
              <g key={spot.key} onClick={() => setSelected(spot.key)} className="cursor-pointer">
                <rect
                  x={spot.x}
                  y={spot.y}
                  width={spot.w}
                  height={spot.h}
                  rx={isTable ? 2.5 : 1.5}
                  strokeWidth={active ? 1 : 0.4}
                  strokeDasharray={spot.kind === "entrance" ? "1.5 1" : undefined}
                  className={active ? "fill-accent-soft stroke-accent" : FILL[spot.kind]}
                />
                <text
                  x={spot.x + spot.w / 2}
                  y={spot.y + spot.h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={isTable ? 4 : 3.2}
                  fontWeight={isTable || active ? 700 : 500}
                  className="pointer-events-none fill-foreground"
                >
                  {isTable ? shortTableLabel(tableLabel.get(spot.tableId ?? "") ?? "") : SPOT_KIND_LABEL[spot.kind]}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex flex-col gap-4">
          {current ? (
            <section className={cn(CARD, "flex flex-col gap-3 p-4")} aria-label={`Editar ${nameOf(current)} no mapa`}>
              <div>
                <p className="font-semibold">{nameOf(current)}</p>
                <p className="text-sm text-muted">{describePosition(current)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className={LABEL}>Mover</p>
                <div className="grid w-fit grid-cols-3 gap-1">
                  <span />
                  <button type="button" className={BUTTON.iconSmall} onClick={() => move(0, -STEP)} aria-label="Mover para o fundo">
                    ↑
                  </button>
                  <span />
                  <button type="button" className={BUTTON.iconSmall} onClick={() => move(-STEP, 0)} aria-label="Mover para a esquerda">
                    ←
                  </button>
                  <span />
                  <button type="button" className={BUTTON.iconSmall} onClick={() => move(STEP, 0)} aria-label="Mover para a direita">
                    →
                  </button>
                  <span />
                  <button type="button" className={BUTTON.iconSmall} onClick={() => move(0, STEP)} aria-label="Mover para a entrada">
                    ↓
                  </button>
                  <span />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1">
                  <p className={LABEL}>Largura</p>
                  <div className="flex gap-1">
                    <button type="button" className={BUTTON.iconSmall} onClick={() => resize(-STEP, 0)} aria-label="Mais estreito">
                      −
                    </button>
                    <button type="button" className={BUTTON.iconSmall} onClick={() => resize(STEP, 0)} aria-label="Mais largo">
                      +
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className={LABEL}>Altura</p>
                  <div className="flex gap-1">
                    <button type="button" className={BUTTON.iconSmall} onClick={() => resize(0, -STEP)} aria-label="Mais baixo">
                      −
                    </button>
                    <button type="button" className={BUTTON.iconSmall} onClick={() => resize(0, STEP)} aria-label="Mais alto">
                      +
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={cn(BUTTON.smallGhost, "self-start")}
                onClick={() => {
                  setDraft((list) => list.filter((spot) => spot.key !== current.key));
                  setSelected(null);
                }}
              >
                Tirar do mapa
              </button>
            </section>
          ) : (
            <p className="text-sm text-muted">Escolha um ponto na lista (ou no desenho) para mover e mudar o tamanho.</p>
          )}

          <div className="flex flex-col gap-2">
            <p className={LABEL}>Pontos no mapa</p>
            {draft.length === 0 ? (
              <p className="text-sm text-muted">O mapa está vazio. Sem pontos, o cliente não vê o botão &quot;Onde fica?&quot;.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {draft.map((spot) => (
                  <li key={spot.key}>
                    <button
                      type="button"
                      aria-pressed={spot.key === selected}
                      className={spot.key === selected ? BUTTON.smallPrimary : BUTTON.small}
                      onClick={() => setSelected(spot.key)}
                    >
                      {nameOf(spot)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {draft.length < FLOOR_LIMITS.spots && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Adicionar ao mapa</span>
                <select className={SELECT} value={adding} onChange={(event) => setAdding(event.target.value)}>
                  <option value="">Escolha…</option>
                  {unplaced.length > 0 && (
                    <optgroup label="Mesas">
                      {unplaced.map((table) => (
                        <option key={table.id} value={`table:${table.id}`}>
                          {table.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Lugares">
                    {LANDMARKS.map((kind) => (
                      <option key={kind} value={kind}>
                        {SPOT_KIND_LABEL[kind]}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <button type="button" className={BUTTON.small} disabled={!adding} onClick={add}>
                Adicionar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BUTTON.primary} disabled={busy || !dirty} onClick={() => void save()}>
          Salvar mapa
        </button>
        <button
          type="button"
          className={BUTTON.ghost}
          disabled={busy || !dirty}
          onClick={() => {
            setDraft(spots.map(toDraft));
            setSelected(null);
          }}
        >
          Desfazer mudanças
        </button>
        {dirty && <p className="text-sm text-muted">Há mudanças não salvas.</p>}
      </div>
    </div>
  );
};
