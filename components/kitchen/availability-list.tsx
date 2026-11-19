"use client";

import { BUTTON, CARD } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { StationFilter } from "@/lib/selectors";
import type { Menu } from "@/types/store";

type Props = {
  menu: Menu;
  station: StationFilter;
  busy: string | null;
  run: (key: string, path: string, body?: unknown) => void;
};

/** Cardápio da estação: esgotar um item tira ele do celular dos clientes na hora. */
export const AvailabilityList = ({ menu, station, busy, run }: Props) => {
  const sections = [...menu.categories]
    .sort((a, b) => a.position - b.position)
    .map((category) => ({
      category,
      items: menu.items.filter(
        (item) => item.categoryId === category.id && (station === "all" || item.station === station),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">Item esgotado some do cardápio dos clientes. Pedidos já feitos continuam na fila.</p>
      {sections.map(({ category, items }) => (
        <section key={category.id} aria-labelledby={`estoque-${category.id}`}>
          <h2 id={`estoque-${category.id}`} className="mb-3 text-lg font-bold">
            {category.name}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id} className={cn(CARD, "flex items-center justify-between gap-3 p-4", !item.available && "opacity-80")}>
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className={cn("text-sm", item.available ? "text-muted" : "font-semibold text-danger")}>
                    {item.available ? "No cardápio" : "Esgotado"}
                  </p>
                </div>
                <button
                  type="button"
                  className={item.available ? BUTTON.small : BUTTON.smallPrimary}
                  disabled={busy === item.id}
                  onClick={() =>
                    run(item.id, `/api/staff/menu/${item.id}/availability`, { available: !item.available })
                  }
                  aria-label={item.available ? `Esgotar ${item.name}` : `Voltar ${item.name} ao cardápio`}
                >
                  {item.available ? "Esgotar" : "Voltar"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
