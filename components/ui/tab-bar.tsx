"use client";

import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/cn";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Contagem ao lado do nome (zero some). */
  badge?: number;
  /** Contagem em destaque (pede ação agora). */
  urgent?: boolean;
  /** Aviso curto embaixo do nome (ex.: "a caminho!"). */
  hint?: string;
};

type Props<T extends string> = {
  items: TabItem<T>[];
  current: T;
  onSelect: (id: T) => void;
  /**
   * `bottom`: barra de abas fixa embaixo em todas as telas (cliente).
   * `responsive`: embaixo no celular e, a partir do `md`, uma fila de abas no topo (equipe).
   */
  layout?: "bottom" | "responsive";
  className?: string;
};

/** Navegação entre as seções de uma tela, com ícone, contagem e a seção atual marcada. */
export const TabBar = <T extends string>({ items, current, onSelect, layout = "bottom", className }: Props<T>) => {
  const responsive = layout === "responsive";
  return (
    <nav
      aria-label="Seções"
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg print:hidden",
        responsive && "md:static md:border-t-0 md:bg-transparent md:pb-0 md:backdrop-blur-none",
        className,
      )}
    >
      <ul className={cn("mx-auto flex max-w-xl", responsive && "md:max-w-none md:gap-1")}>
        {items.map(({ id, label, icon: Icon, badge, urgent, hint }) => {
          const active = current === id;
          return (
            <li key={id} className={cn("flex-1", responsive && "md:flex-none")}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSelect(id)}
                className={cn(
                  "group flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent",
                  responsive &&
                    "md:min-h-11 md:flex-row md:gap-2 md:rounded-full md:px-4 md:text-sm md:hover:bg-surface",
                  active ? "text-accent" : "text-muted hover:text-foreground",
                  active && responsive && "md:bg-accent-soft md:hover:bg-accent-soft",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-accent-soft",
                    responsive && "md:h-auto md:w-auto md:bg-transparent",
                  )}
                >
                  <Icon className="size-[22px]" />
                </span>
                <span className="flex items-center gap-1.5">
                  {label}
                  {badge !== undefined && badge > 0 && (
                    <span
                      className={cn(
                        "min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-bold",
                        urgent ? "bg-accent text-on-accent" : "bg-surface text-foreground",
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </span>
                {hint && <span className="text-[11px] font-medium text-accent">{hint}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
