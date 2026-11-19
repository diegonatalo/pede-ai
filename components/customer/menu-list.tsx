"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { MenuPhoto } from "@/components/ui/menu-photo";
import { BADGE, BUTTON, CARD, INPUT } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { cartQuantity, type Cart, type CartAction } from "@/lib/cart";
import { formatCents } from "@/lib/money";
import type { Menu } from "@/types/store";

type Props = { menu: Menu; cart: Cart; dispatch: (action: CartAction) => void };

/** Busca sem acento e sem diferença de maiúsculas. */
const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export const MenuList = ({ menu, cart, dispatch }: Props) => {
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const term = normalize(query.trim());
    return [...menu.categories]
      .sort((a, b) => a.position - b.position)
      .map((category) => ({
        category,
        items: menu.items.filter(
          (item) =>
            item.categoryId === category.id &&
            (!term || normalize(`${item.name} ${item.description}`).includes(term)),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [menu, query]);

  return (
    <div className="flex flex-col gap-6">
      <label className="relative flex flex-col gap-1">
        <span className="sr-only">Buscar no cardápio</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          className={cn(INPUT, "pl-11")}
          placeholder="Buscar no cardápio"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {sections.length > 0 && !query && (
        <nav aria-label="Categorias" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {sections.map(({ category }) => (
            <a
              key={category.id}
              href={`#categoria-${category.id}`}
              className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-soft transition hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {category.name}
            </a>
          ))}
        </nav>
      )}

      {sections.length === 0 && <p className="py-6 text-center text-muted">Nada encontrado para “{query}”.</p>}

      {sections.map(({ category, items }) => (
        <section key={category.id} id={`categoria-${category.id}`} className="scroll-mt-24" aria-labelledby={`titulo-${category.id}`}>
          <h2 id={`titulo-${category.id}`} className="mb-3 text-xl font-bold">
            {category.name}
          </h2>
          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const quantity = cartQuantity(cart, item.id);
              return (
                <li
                  key={item.id}
                  className={cn(CARD, "flex gap-3 p-3", quantity > 0 && "border-accent/50 ring-1 ring-accent/30")}
                >
                  <MenuPhoto
                    src={item.photoUrl}
                    alt={item.name}
                    sizes="104px"
                    className={cn("size-26 rounded-2xl", !item.available && "opacity-50 grayscale")}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="leading-snug font-semibold">{item.name}</h3>
                    {item.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted">{item.description}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <p className="font-bold">{formatCents(item.priceCents)}</p>
                      {!item.available ? (
                        <span className={BADGE.neutral}>Esgotado</span>
                      ) : quantity === 0 ? (
                        <button
                          type="button"
                          className={BUTTON.smallPrimary}
                          onClick={() => dispatch({ type: "add", menuItemId: item.id })}
                          aria-label={`Adicionar ${item.name}`}
                        >
                          Adicionar
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className={BUTTON.iconSmall}
                            onClick={() => dispatch({ type: "decrement", menuItemId: item.id })}
                            aria-label={`Tirar um ${item.name}`}
                          >
                            −
                          </button>
                          <span className="min-w-6 text-center font-bold" aria-label={`${quantity} no carrinho`}>
                            {quantity}
                          </span>
                          <button
                            type="button"
                            className={BUTTON.iconAccent}
                            onClick={() => dispatch({ type: "add", menuItemId: item.id })}
                            aria-label={`Mais um ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
