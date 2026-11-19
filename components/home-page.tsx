import Link from "next/link";
import { BUTTON, CARD } from "@/components/ui/styles";
import { DEMO_PINS } from "@/lib/api/config";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

const STEPS = [
  { title: "Escaneie o QR da mesa", desc: "Cada pessoa abre a própria comanda no celular." },
  { title: "Peça quando quiser", desc: "Os itens vão direto para a cozinha ou para o bar." },
  { title: "Acompanhe o pedido", desc: "O garçom é avisado quando fica pronto e leva até a mesa." },
  { title: "Conta separada", desc: "Cada comanda paga o que pediu, com itens divididos." },
];

export const HomePage = () => (
  <main id="conteudo" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-20">
    <header className="flex flex-col gap-4">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Em construção</p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{SITE_NAME}</h1>
      <p className="max-w-xl text-lg text-muted">{SITE_DESCRIPTION}</p>
    </header>
    <ol className="grid gap-4 sm:grid-cols-2">
      {STEPS.map((step, index) => (
        <li key={step.title} className={`${CARD} p-5`}>
          <p className="text-sm font-semibold text-accent">Passo {index + 1}</p>
          <h2 className="mt-1 font-semibold">{step.title}</h2>
          <p className="mt-1 text-sm text-muted">{step.desc}</p>
        </li>
      ))}
    </ol>
    <section aria-labelledby="titulo-demo" className={`${CARD} flex flex-col gap-4 p-6`}>
      <h2 id="titulo-demo" className="text-xl font-bold">
        Experimente a demonstração
      </h2>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted">
        <li>
          Abra a tela do garçom (PIN <strong className="font-mono text-foreground">{DEMO_PINS.waiter}</strong>) e abra
          uma mesa: aparece o código de 4 números.
        </li>
        <li>
          Em outro celular, ou numa janela anônima, abra a mesa como cliente, digite o código e faça um pedido.
        </li>
        <li>
          No garçom, confirme o pedido. Na cozinha (PIN{" "}
          <strong className="font-mono text-foreground">{DEMO_PINS.kitchen}</strong>), comece e marque como pronto.
        </li>
        <li>O garçom retira, entrega, marca as comandas como pagas e fecha a mesa.</li>
      </ol>
      <p className="text-sm text-muted">
        Os dados ficam só na memória do servidor da demonstração e somem quando ele reinicia.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/garcom" className={BUTTON.primary}>
          Tela do garçom
        </Link>
        <Link href="/cozinha" className={BUTTON.secondary}>
          Cozinha e bar
        </Link>
        <Link href="/mesa/mesa-1" className={BUTTON.secondary}>
          Mesa 1 (cliente)
        </Link>
      </div>
    </section>
  </main>
);
