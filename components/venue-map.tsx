import { describePosition, landmarks, SPOT_KIND_LABEL } from "@/lib/map";
import type { MapSpot, MapSpotKind, Table } from "@/types/domain";

type Props = {
  spots: MapSpot[];
  tables: Pick<Table, "id" | "label">[];
  /** Mesa em destaque ("Você está aqui"). */
  highlightTableId?: string;
};

const FILL: Record<MapSpotKind, string> = {
  table: "fill-card stroke-border",
  kitchen: "fill-warning-soft stroke-warning/60",
  bar: "fill-accent-soft stroke-accent/60",
  restroom: "fill-info-soft stroke-info/60",
  cashier: "fill-success-soft stroke-success/60",
  entrance: "fill-transparent stroke-muted",
};

/**
 * Planta do salão numa grade de 100 × 100 (fundo em cima, entrada embaixo).
 * O desenho é decorativo para leitores de tela: a lista abaixo diz o mesmo em palavras.
 */
export const VenueMap = ({ spots, tables, highlightTableId }: Props) => {
  const highlighted = spots.find((spot) => spot.tableId && spot.tableId === highlightTableId);
  const tableLabel = tables.find((table) => table.id === highlightTableId)?.label;

  return (
    <figure className="flex flex-col gap-4">
      <svg viewBox="-1 -1 102 102" className="w-full rounded-2xl border border-border bg-background" aria-hidden="true">
        {spots.map((spot) => {
          const mine = spot === highlighted;
          const isTable = spot.kind === "table";
          return (
            <g key={spot.id}>
              <rect
                x={spot.x}
                y={spot.y}
                width={spot.w}
                height={spot.h}
                rx={isTable ? 2.5 : 1.5}
                strokeWidth={mine ? 1 : 0.4}
                strokeDasharray={spot.kind === "entrance" ? "1.5 1" : undefined}
                // Uma classe de cor ou outra, nunca as duas: com as duas, vence a que vem depois no CSS.
                className={mine ? "fill-accent stroke-accent" : FILL[spot.kind]}
              />
              <text
                x={spot.x + spot.w / 2}
                y={spot.y + spot.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isTable ? 4 : 3.4}
                fontWeight={mine || isTable ? 700 : 500}
                className={mine ? "fill-on-accent" : "fill-foreground"}
              >
                {isTable ? spot.label : SPOT_KIND_LABEL[spot.kind]}
              </text>
              {mine && (
                <text
                  x={spot.x + spot.w / 2}
                  y={spot.y - 2.5}
                  textAnchor="middle"
                  fontSize={3.2}
                  fontWeight={700}
                  className="fill-accent"
                >
                  Você
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <ul className="flex flex-col gap-1 text-sm">
          {highlighted && tableLabel && (
            <li className="font-semibold">
              Sua mesa: {tableLabel}, {describePosition(highlighted)}.
            </li>
          )}
          {landmarks(spots).map((spot) => (
            <li key={spot.id} className="text-muted">
              <span className="font-semibold text-foreground">{SPOT_KIND_LABEL[spot.kind]}:</span>{" "}
              {describePosition(spot)}.
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
};
