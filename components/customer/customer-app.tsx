"use client";

import { useParams } from "next/navigation";
import { CreateTabForm } from "@/components/customer/create-tab-form";
import { CustomerHome } from "@/components/customer/customer-home";
import { JoinTable } from "@/components/customer/join-table";
import { BUTTON, CARD } from "@/components/ui/styles";
import { useCustomerView } from "@/hooks/use-customer-view";

const Centered = ({ children }: { children: React.ReactNode }) => (
  <main id="conteudo" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
    {children}
  </main>
);

/**
 * Tela do QR code da mesa. Sem cookie: entra com o código. Sem comanda: abre a primeira.
 * Com tudo: cardápio, pedido e acompanhamento.
 */
export const CustomerApp = () => {
  const { id } = useParams<{ id: string }>();
  const { state, refresh } = useCustomerView();

  if (state.status === "loading") {
    return (
      <Centered>
        <p className="text-center text-muted" role="status">
          Carregando…
        </p>
      </Centered>
    );
  }

  if (state.status === "error") {
    return (
      <Centered>
        <section className={`${CARD} p-6 text-center`}>
          <h1 className="text-2xl font-bold">Não deu para carregar a mesa</h1>
          <p className="mt-2 text-muted">{state.message}</p>
          <button type="button" className={`${BUTTON.primary} mt-6`} onClick={() => void refresh()}>
            Tentar de novo
          </button>
        </section>
      </Centered>
    );
  }

  if (state.status === "closed") {
    return (
      <Centered>
        <section className={`${CARD} p-6 text-center`}>
          <h1 className="text-2xl font-bold">Mesa fechada. Obrigado pela visita!</h1>
          <p className="mt-2 text-muted">Se vocês ainda estão aqui, peça ao garçom para abrir a mesa de novo.</p>
          <JoinAgain tableId={id} onJoined={() => void refresh()} />
        </section>
      </Centered>
    );
  }

  // Cookie de outra mesa: o QR desta mesa pede o código desta.
  if (state.status === "guest" || state.data.view.session.tableId !== id) {
    return (
      <Centered>
        <JoinTable tableId={id} onJoined={() => void refresh()} />
      </Centered>
    );
  }

  if (!state.data.view.tabs.some((tab) => tab.mine)) {
    return (
      <Centered>
        <CreateTabForm mode="self" onCreated={() => void refresh()} />
      </Centered>
    );
  }

  return <CustomerHome data={state.data} refresh={refresh} />;
};

const JoinAgain = ({ tableId, onJoined }: { tableId: string; onJoined: () => void }) => (
  <details className="mt-6 text-left">
    <summary className="cursor-pointer text-center font-semibold text-accent">Tenho um código novo</summary>
    <div className="mt-4">
      <JoinTable tableId={tableId} onJoined={onJoined} />
    </div>
  </details>
);
