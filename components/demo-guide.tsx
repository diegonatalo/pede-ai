import Link from "next/link";
import { BUTTON, CARD } from "@/components/ui/styles";
import { DEMO_PINS } from "@/lib/seed-data";

const STEPS = [
  { title: "Escaneie o QR da mesa", desc: "Cada pessoa abre a própria comanda no celular." },
  { title: "Peça quando quiser", desc: "Os itens vão direto para a cozinha ou para o bar." },
  { title: "Acompanhe o pedido", desc: "O garçom é avisado quando fica pronto e leva até a mesa." },
  { title: "Conta separada", desc: "Cada comanda paga o que pediu, com itens divididos." },
];

/** Guia da demonstração: o que fazer em cada tela, com os PINs públicos. */
export const DemoGuide = () => (
  <main id="conteudo" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-20">
    <header className="flex flex-col gap-4">
      <Link href="/" className="self-start text-sm font-semibold text-accent hover:underline">
        ← Pede Aí
      </Link>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Demonstração</h1>
      <p className="max-w-xl text-lg text-muted">
        Um restaurante de exemplo, aberto para todo mundo. Faça o papel do garçom, da cozinha e do cliente, cada um
        numa aba ou num celular.
      </p>
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
        Passo a passo
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
        A demonstração é compartilhada e volta ao começo todo dia, às 6h.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/r/demo/garcom" className={BUTTON.primary}>
          Tela do garçom
        </Link>
        <Link href="/r/demo/cozinha" className={BUTTON.secondary}>
          Cozinha e bar
        </Link>
        <Link href="/r/demo/mesa/mesa-1" className={BUTTON.secondary}>
          Mesa 1 (cliente)
        </Link>
      </div>
    </section>
    <section aria-labelledby="titulo-restaurantes" className={`${CARD} flex flex-col gap-3 p-6`}>
      <h2 id="titulo-restaurantes" className="text-xl font-bold">
        Tem um restaurante?
      </h2>
      <p className="text-muted">Crie a sua conta e cadastre o restaurante: ele começa com o salão e o cardápio de exemplo, e você entra como gerente.</p>
      <Link href="/conta" className={`${BUTTON.primary} self-start`}>
        Criar conta ou entrar
      </Link>
    </section>
  </main>
);
