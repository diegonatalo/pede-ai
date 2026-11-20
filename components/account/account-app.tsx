"use client";

import { DeleteAccount } from "@/components/account/delete-account";
import { OwnRestaurants } from "@/components/account/own-restaurants";
import { SignInForm } from "@/components/account/sign-in-form";
import { BUTTON, CARD } from "@/components/ui/styles";
import { useAccount } from "@/hooks/use-account";

/** Área do dono do restaurante: a conta e os restaurantes dela. */
export const AccountApp = () => {
  const { state, refresh, signOut } = useAccount();

  if (state.status === "loading") {
    return (
      <p className="py-20 text-center text-muted" role="status">
        Carregando…
      </p>
    );
  }

  if (state.status === "guest") return <SignInForm onSignedIn={() => void refresh()} />;

  const { account } = state;
  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-10">
      <section className={`${CARD} flex flex-wrap items-start justify-between gap-4 p-6`}>
        <div>
          <p className="text-sm font-semibold text-accent">Sua conta</p>
          <h1 className="mt-1 text-2xl font-bold">Olá, {account.name}</h1>
          <p className="mt-1 text-muted">{account.email}</p>
        </div>
        <button type="button" className={BUTTON.secondary} onClick={() => void signOut()}>
          Sair
        </button>
      </section>
      <section className={`${CARD} p-6`} aria-label="Restaurantes">
        <OwnRestaurants />
      </section>
      <section className={`${CARD} flex flex-col gap-3 p-6`} aria-labelledby="titulo-privacidade">
        <h2 id="titulo-privacidade" className="text-lg font-bold">
          Seus dados
        </h2>
        <p className="text-sm text-muted">
          Você pode excluir a conta quando quiser. Os restaurantes dela e tudo o que eles guardam são apagados junto.
        </p>
        <DeleteAccount onDeleted={() => void refresh()} />
      </section>
    </main>
  );
};
