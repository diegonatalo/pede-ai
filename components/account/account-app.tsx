"use client";

import { SignInForm } from "@/components/account/sign-in-form";
import { BUTTON, CARD } from "@/components/ui/styles";
import { useAccount } from "@/hooks/use-account";

/**
 * Área do dono do restaurante. Por enquanto só a conta; o cadastro do restaurante,
 * do cardápio e da equipe entram nas próximas etapas.
 */
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
    <main id="conteudo" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10">
      <section className={`${CARD} flex flex-col gap-4 p-6`}>
        <div>
          <p className="text-sm font-semibold text-accent">Sua conta</p>
          <h1 className="mt-1 text-2xl font-bold">Olá, {account.name}</h1>
          <p className="mt-1 text-muted">{account.email}</p>
        </div>
        <p className="rounded-xl bg-border/40 p-3 text-sm">
          Em breve, aqui você cadastra o seu restaurante, o cardápio, as mesas e a equipe.
        </p>
        <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => void signOut()}>
          Sair
        </button>
      </section>
    </main>
  );
};
