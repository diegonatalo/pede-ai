"use client";

import { useReducer, useState } from "react";
import { BillView } from "@/components/customer/bill-view";
import { CallWaiter } from "@/components/customer/call-waiter";
import { CartView } from "@/components/customer/cart-view";
import { CreateTabForm } from "@/components/customer/create-tab-form";
import { MenuList } from "@/components/customer/menu-list";
import { OrdersList } from "@/components/customer/orders-list";
import { BUTTON } from "@/components/ui/styles";
import type { CustomerData } from "@/hooks/use-customer-view";
import { apiRequest } from "@/lib/api-client";
import { cartCount, cartReducer, cartToLines, cartTotal } from "@/lib/cart";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import { canOrder } from "@/lib/transitions";

type Section = "menu" | "cart" | "orders" | "bill" | "call" | "new-tab";

type Props = { data: CustomerData; refresh: () => Promise<void> };

export const CustomerHome = ({ data, refresh }: Props) => {
  const { view, menu } = data;
  const myTabs = view.tabs.filter((tab) => tab.mine);
  const [section, setSection] = useState<Section>("menu");
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [chosenTabId, setChosenTabId] = useState(myTabs[0]?.id ?? "");
  const [sending, setSending] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  // A comanda escolhida pode ter sido fechada (conta pedida, paga): cai na primeira que aceita pedido.
  const activeTab =
    myTabs.find((tab) => tab.id === chosenTabId && canOrder(tab)) ?? myTabs.find((tab) => canOrder(tab)) ?? myTabs[0];
  const count = cartCount(cart);

  const send = async () => {
    if (!activeTab) return;
    setSending(true);
    setMessage("");
    const response = await apiRequest("/api/customer/orders", {
      method: "POST",
      body: { tabId: activeTab.id, lines: cartToLines(cart) },
    });
    setSending(false);
    if (!response.ok) {
      setMessage(response.message);
      await refresh();
      return;
    }
    dispatch({ type: "clear" });
    // A confirmação pendente já aparece na lista de pedidos; aqui basta dizer que foi.
    go("orders");
    setNotice("Pedido enviado!");
    await refresh();
  };

  const cancel = async (itemId: string) => {
    setBusyItemId(itemId);
    const response = await apiRequest(`/api/customer/items/${itemId}/status`, {
      method: "POST",
      body: { to: "canceled" },
    });
    setBusyItemId(null);
    setNotice(response.ok ? "Item cancelado." : response.message);
    await refresh();
  };

  const go = (next: Section) => {
    setNotice("");
    setMessage("");
    setSection(next);
    // Cada seção começa do topo, senão o carrinho abre no meio da rolagem do cardápio.
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="flex flex-1 flex-col pb-40 md:pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">{view.restaurant.name}</p>
            <h1 className="text-lg font-bold">{view.table.label}</h1>
          </div>
          {myTabs.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Comanda</span>
              <select
                className="min-h-11 rounded-xl border border-border bg-card px-3 font-semibold"
                value={activeTab?.id}
                onChange={(event) => {
                  if (event.target.value === "__new") go("new-tab");
                  else setChosenTabId(event.target.value);
                }}
              >
                {myTabs.map((tab) => (
                  <option key={tab.id} value={tab.id} disabled={!canOrder(tab)}>
                    {tab.customerName}
                    {canOrder(tab) ? "" : " (fechada)"}
                  </option>
                ))}
                <option value="__new">+ Para outra pessoa</option>
              </select>
            </label>
          )}
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-xl flex-1 px-4 py-5">
        {notice && (
          <p className="mb-4 rounded-xl bg-emerald-100 p-3 text-sm font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" role="status">
            {notice}
          </p>
        )}
        {section === "menu" && <MenuList menu={menu} cart={cart} dispatch={dispatch} />}
        {section === "cart" && (
          <CartView
            menu={menu}
            cart={cart}
            dispatch={dispatch}
            tabName={activeTab?.customerName ?? ""}
            needsApproval={activeTab ? !activeTab.approved : false}
            sending={sending}
            message={activeTab && canOrder(activeTab) ? message : "Esta comanda não aceita novos pedidos."}
            onSend={() => void send()}
            onBack={() => go("menu")}
          />
        )}
        {section === "orders" && (
          <OrdersList view={view} busyItemId={busyItemId} onCancel={(id) => void cancel(id)} onBrowse={() => go("menu")} />
        )}
        {section === "bill" && <BillView view={view} refresh={refresh} />}
        {section === "call" && <CallWaiter view={view} tabId={activeTab?.id} refresh={refresh} />}
        {section === "new-tab" && (
          <CreateTabForm
            mode="other"
            onCancel={() => go("menu")}
            onCreated={async (tab) => {
              await refresh();
              setChosenTabId(tab.id);
              go("menu");
              setNotice(`Comanda de ${tab.customerName} aberta. Os próximos pedidos vão para ela.`);
            }}
          />
        )}
      </main>

      {count > 0 && section === "menu" && (
        <div className="fixed inset-x-0 bottom-16 z-20 px-4 md:bottom-20">
          <button
            type="button"
            className={cn(BUTTON.primary, "mx-auto flex w-full max-w-xl shadow-lg")}
            onClick={() => go("cart")}
          >
            <span>Ver pedido ({count})</span>
            <span>{formatCents(cartTotal(cart, menu.items))}</span>
          </button>
        </div>
      )}

      <nav aria-label="Seções" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <ul className="mx-auto grid max-w-xl grid-cols-4">
          {(
            [
              ["menu", "Cardápio"],
              ["orders", "Pedidos"],
              ["bill", "Conta"],
              ["call", "Chamar"],
            ] as const
          ).map(([id, label]) => {
            const current = section === id || (id === "menu" && (section === "cart" || section === "new-tab"));
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={current ? "page" : undefined}
                  onClick={() => go(id)}
                  className={cn(
                    "flex min-h-16 w-full flex-col items-center justify-center text-sm font-semibold",
                    current ? "text-accent" : "text-muted",
                  )}
                >
                  {label}
                  {id === "orders" && view.items.some((item) => item.status === "ready" || item.status === "picked_up") && (
                    <span className="text-xs font-medium">a caminho!</span>
                  )}
                  {id === "call" && view.calls.some((call) => call.status === "acknowledged") && (
                    <span className="text-xs font-medium">vindo!</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};
