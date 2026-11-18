import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

const STEPS = [
  { title: "Escaneie o QR da mesa", desc: "Cada pessoa abre a própria comanda no celular." },
  { title: "Peça quando quiser", desc: "Os itens vão direto para a cozinha ou para o bar." },
  { title: "Acompanhe o pedido", desc: "O garçom é avisado quando fica pronto e leva até a mesa." },
  { title: "Conta separada", desc: "Cada comanda paga o que pediu, com itens divididos." },
];

export const HomePage = () => (
  <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-20">
    <header className="flex flex-col gap-4">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Em construção</p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{SITE_NAME}</h1>
      <p className="max-w-xl text-lg text-muted">{SITE_DESCRIPTION}</p>
    </header>
    <ol className="grid gap-4 sm:grid-cols-2">
      {STEPS.map((step, index) => (
        <li key={step.title} className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-accent">Passo {index + 1}</p>
          <h2 className="mt-1 font-semibold">{step.title}</h2>
          <p className="mt-1 text-sm text-muted">{step.desc}</p>
        </li>
      ))}
    </ol>
  </main>
);
