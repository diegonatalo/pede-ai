"use client";

import { useMemo, useState } from "react";
import { BUTTON, CARD, INPUT } from "@/components/ui/styles";
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
      <label className="flex flex-col gap-1">
        <span className="sr-only">Buscar no cardápio</span>
        <input
          type="search"
          className={INPUT}
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
              className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-border/40"
            >
              {category.name}
            </a>
          ))}
        </nav>
      )}

      {sections.length === 0 && <p className="py-6 text-center text-muted">Nada encontrado para “{query}”.</p>}

      {sections.map(({ category, items }) => (
        <section key={category.id} id={`categoria-${category.id}`} className="scroll-mt-20" aria-labelledby={`titulo-${category.id}`}>
          <h2 id={`titulo-${category.id}`} className="mb-3 text-lg font-bold">
            {category.name}
          </h2>
          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const quantity = cartQuantity(cart, item.id);
              return (
                <li key={item.id} className={`${CARD} flex items-start gap-3 p-4`}>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="mt-0.5 text-sm text-muted">{item.description}</p>
                    <p className="mt-2 font-semibold">{formatCents(item.priceCents)}</p>
                  </div>
                  {!item.available ? (
                    <span className="self-center rounded-full bg-border/60 px-3 py-1 text-sm font-semibold text-muted">
                      Esgotado
                    </span>
                  ) : quantity === 0 ? (
                    <button
                      type="button"
                      className={`${BUTTON.secondary} self-center`}
                      onClick={() => dispatch({ type: "add", menuItemId: item.id })}
                      aria-label={`Adicionar ${item.name}`}
                    >
                      Adicionar
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 self-center">
                      <button
                        type="button"
                        className={BUTTON.icon}
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
                        className={BUTTON.icon}
                        onClick={() => dispatch({ type: "add", menuItemId: item.id })}
                        aria-label={`Mais um ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
