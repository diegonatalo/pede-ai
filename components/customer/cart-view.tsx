"use client";

import { MenuPhoto } from "@/components/ui/menu-photo";
import { BUTTON, CARD, INPUT, PANEL } from "@/components/ui/styles";
import { cartTotal, unavailableInCart, type Cart, type CartAction } from "@/lib/cart";
import { formatCents } from "@/lib/money";
import { LIMITS } from "@/lib/store/input";
import type { Menu } from "@/types/store";

type Props = {
  menu: Menu;
  cart: Cart;
  dispatch: (action: CartAction) => void;
  tabName: string;
  needsApproval: boolean;
  sending: boolean;
  message: string;
  onSend: () => void;
  onBack: () => void;
};

export const CartView = ({ menu, cart, dispatch, tabName, needsApproval, sending, message, onSend, onBack }: Props) => {
  const byId = new Map(menu.items.map((item) => [item.id, item]));
  const soldOut = new Set(unavailableInCart(cart, menu.items));

  if (cart.length === 0) {
    return (
      <section className={`${CARD} p-6 text-center`}>
        <h2 className="text-xl font-bold">O carrinho está vazio</h2>
        <p className="mt-2 text-muted">Escolha alguma coisa no cardápio.</p>
        <button type="button" className={`${BUTTON.primary} mt-6`} onClick={onBack}>
          Ver o cardápio
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-carrinho">
      <div>
        <h2 id="titulo-carrinho" className="text-xl font-bold">
          Seu pedido
        </h2>
        <p className="text-sm text-muted">Vai para a comanda de {tabName}.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {cart.map((line) => {
          const item = byId.get(line.menuItemId);
          const name = item?.name ?? "Item fora do cardápio";
          return (
            <li key={line.menuItemId} className={`${CARD} flex flex-col gap-3 p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <MenuPhoto src={item?.photoUrl} alt={name} sizes="56px" className="size-14 rounded-xl" />
                  <div className="min-w-0">
                    <h3 className="font-semibold">{name}</h3>
                    <p className="text-sm text-muted">
                      {line.quantity} × {formatCents(item?.priceCents ?? 0)}
                    </p>
                    {soldOut.has(line.menuItemId) && (
                      <p className="mt-1 text-sm font-semibold text-danger">Esgotou. Tire do pedido.</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={BUTTON.iconSmall}
                    aria-label={`Tirar um ${name}`}
                    onClick={() => dispatch({ type: "decrement", menuItemId: line.menuItemId })}
                  >
                    −
                  </button>
                  <span className="min-w-6 text-center font-bold">{line.quantity}</span>
                  <button
                    type="button"
                    className={BUTTON.iconAccent}
                    aria-label={`Mais um ${name}`}
                    disabled={soldOut.has(line.menuItemId)}
                    onClick={() => dispatch({ type: "add", menuItemId: line.menuItemId })}
                  >
                    +
                  </button>
                </div>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-muted">Observação (opcional)</span>
                <input
                  className={INPUT}
                  maxLength={LIMITS.note}
                  placeholder="Ex.: sem cebola, ponto da carne"
                  value={line.note}
                  onChange={(event) => dispatch({ type: "note", menuItemId: line.menuItemId, note: event.target.value })}
                />
              </label>
            </li>
          );
        })}
      </ul>

      <div className={`${PANEL} flex items-center justify-between p-4`}>
        <span className="font-semibold">Total dos itens</span>
        <span className="font-display text-2xl font-bold">{formatCents(cartTotal(cart, menu.items))}</span>
      </div>
      {needsApproval && (
        <p className="rounded-2xl bg-warning-soft p-3 text-sm font-medium text-warning">
          No primeiro pedido, o garçom confirma antes de mandar para a cozinha.
        </p>
      )}
      {message && (
        <p className="text-sm font-medium text-danger" role="alert">
          {message}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <button type="button" className={BUTTON.primaryLarge} disabled={sending || soldOut.size > 0} onClick={onSend}>
          {sending ? "Enviando…" : "Enviar pedido"}
        </button>
        <button type="button" className={BUTTON.ghost} onClick={onBack}>
          Continuar escolhendo
        </button>
      </div>
    </section>
  );
};
