"use client";

import { useReducer, useState } from "react";
import { BillView } from "@/components/customer/bill-view";
import { CallWaiter } from "@/components/customer/call-waiter";
import { CartView } from "@/components/customer/cart-view";
import { CreateTabForm } from "@/components/customer/create-tab-form";
import { MenuList } from "@/components/customer/menu-list";
import { OrdersList } from "@/components/customer/orders-list";
import { BUTTON, EYEBROW, SELECT } from "@/components/ui/styles";
import { VenueMap } from "@/components/venue-map";
import type { CustomerData } from "@/hooks/use-customer-view";
import { useApi } from "@/hooks/use-restaurant";
import { cartCount, cartReducer, cartToLines, cartTotal } from "@/lib/cart";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import { canOrder } from "@/lib/transitions";
import { TabBar } from "@/components/ui/tab-bar";
import { BellIcon, ReceiptIcon, UtensilsIcon, WalletIcon } from "@/components/ui/icons";

type Section = "menu" | "cart" | "orders" | "bill" | "call" | "map" | "new-tab";

type Props = { data: CustomerData; refresh: () => Promise<void> };

export const CustomerHome = ({ data, refresh }: Props) => {
  const apiRequest = useApi();
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
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className={EYEBROW}>{view.restaurant.name}</p>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl leading-tight font-bold">{view.table.label}</h1>
              {view.mapSpots.length > 0 && (
                <button
                  type="button"
                  className="min-h-11 text-sm font-semibold text-accent underline-offset-2 hover:underline"
                  aria-current={section === "map" ? "page" : undefined}
                  onClick={() => go("map")}
                >
                  Onde fica?
                </button>
              )}
            </div>
          </div>
          {myTabs.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Comanda</span>
              <select
                className={SELECT}
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
          <p className="mb-4 rounded-2xl bg-success-soft p-3 text-sm font-medium text-success" role="status">
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
        {section === "map" && (
          <section className="flex flex-col gap-4" aria-labelledby="titulo-mapa">
            <h2 id="titulo-mapa" className="text-xl font-bold">
              Mapa do salão
            </h2>
            <VenueMap spots={view.mapSpots} tables={[view.table]} highlightTableId={view.table.id} />
          </section>
        )}
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
            className={cn(BUTTON.primary, "mx-auto flex w-full max-w-xl justify-between")}
            onClick={() => go("cart")}
          >
            <span>Ver pedido ({count})</span>
            <span>{formatCents(cartTotal(cart, menu.items))}</span>
          </button>
        </div>
      )}

      <TabBar
        current={section === "cart" || section === "new-tab" || section === "map" ? "menu" : section}
        onSelect={go}
        items={[
          { id: "menu", label: "Cardápio", icon: UtensilsIcon },
          {
            id: "orders",
            label: "Pedidos",
            icon: ReceiptIcon,
            hint: view.items.some((item) => item.status === "ready" || item.status === "picked_up") ? "a caminho!" : undefined,
          },
          { id: "bill", label: "Conta", icon: WalletIcon },
          {
            id: "call",
            label: "Chamar",
            icon: BellIcon,
            hint: view.calls.some((call) => call.status === "acknowledged") ? "vindo!" : undefined,
          },
        ]}
      />
    </div>
  );
};
