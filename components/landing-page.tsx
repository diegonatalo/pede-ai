import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import bar from "@/public/images/landing/bar.webp";
import cafe from "@/public/images/landing/cafe.webp";
import celular from "@/public/images/landing/celular.webp";
import cozinha from "@/public/images/landing/cozinha.webp";
import hero from "@/public/images/landing/hero.webp";
import mesaAmigos from "@/public/images/landing/mesa-amigos.webp";
import salao from "@/public/images/landing/salao.webp";
import { BrandMark } from "@/components/ui/brand";
import { BUTTON } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { SITE_NAME } from "@/lib/site";

/** Botão claro sobre foto escura (o `secondary` depende do tema e some em cima da imagem). */
const ON_PHOTO =
  "inline-flex min-h-13 items-center justify-center rounded-full border border-white/70 px-7 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const HIGHLIGHTS = [
  { title: "Sem app para instalar", text: "O cliente aponta a câmera para o QR da mesa e pede no navegador." },
  { title: "Uma comanda por pessoa", text: "Cada um pede e paga o que é seu, e dá para dividir o vinho." },
  { title: "Grátis para começar", text: "Crie a conta, cadastre o restaurante e teste com a sua equipe." },
];

type Step = { eyebrow: string; title: string; text: string; image: StaticImageData; alt: string };

const STEPS: Step[] = [
  {
    eyebrow: "1 · Na mesa",
    title: "O cliente pede pelo celular, na hora que quiser",
    text: "O garçom abre a mesa e passa um código de 4 números. Cada pessoa abre a própria comanda, vê o cardápio com preços e manda o pedido sem esperar alguém passar.",
    image: celular,
    alt: "Pessoa segurando o celular à mesa de um café",
  },
  {
    eyebrow: "2 · Na cozinha e no bar",
    title: "Cada pedido cai direto na fila certa",
    text: "Pratos vão para a cozinha, drinques para o bar. A fila mostra o que chegou, o que está em preparo e o que está pronto, e o item esgotado sai do cardápio com um toque.",
    image: cozinha,
    alt: "Chef montando um prato sob luminárias de cobre",
  },
  {
    eyebrow: "3 · No salão",
    title: "O garçom sabe o que levar e quem chamou",
    text: "Ficou pronto, o garçom é avisado com som e vibração. O cliente chama o garçom ou pede a conta pelo celular, e o chamado aparece na tela da equipe.",
    image: salao,
    alt: "Restaurante cheio, com pessoas conversando e comendo",
  },
  {
    eyebrow: "4 · Na hora de pagar",
    title: "Conta separada, sem calculadora na mesa",
    text: "Cada comanda tem o próprio total, com taxa de serviço e couvert. O que foi dividido sai em partes certas, centavo por centavo, e o garçom fecha a mesa quando todos pagaram.",
    image: mesaAmigos,
    alt: "Amigos dividindo hambúrgueres e batatas numa mesa redonda",
  },
];

const FEATURES = [
  { title: "Cardápio editável", text: "Categorias, itens, preços e ordem, mudando na hora para os clientes." },
  { title: "Equipe com PIN pessoal", text: "Garçom, cozinha e gerente entram com o próprio PIN, e cada ação fica registrada." },
  { title: "Números do dia", text: "Faturamento, ticket por pessoa, tempos de preparo e entrega e os mais pedidos." },
  { title: "QR codes prontos", text: "Um por mesa, para imprimir e colar. O mapa do salão ajuda o cliente a se achar." },
];

export const LandingPage = () => (
  <>
    <header className="relative isolate flex min-h-[92svh] flex-col overflow-hidden text-white">
      <Image
        src={hero}
        alt=""
        fill
        preload
        placeholder="blur"
        sizes="100vw"
        className="-z-20 object-cover"
      />
      {/* Escurece a foto para o texto ter contraste em qualquer tela. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/55 to-black/85" aria-hidden="true" />
      <nav aria-label="Principal" className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <BrandMark onPhoto />
        <Link href="/conta" className="rounded-full px-4 py-2 font-semibold hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
          Entrar
        </Link>
      </nav>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-6 pb-20">
        <p className="text-sm font-semibold tracking-widest text-orange-300 uppercase">
          Para restaurantes, bares e cafeterias
        </p>
        <h1 className="max-w-3xl text-4xl leading-tight font-bold tracking-tight text-balance sm:text-6xl">
          O pedido sai da mesa e chega na cozinha. A conta sai certa para cada um.
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-white/85 sm:text-xl">
          Com o {SITE_NAME}, o cliente escaneia o QR da mesa e pede pelo celular. A cozinha e o bar recebem na hora, o
          garçom é avisado quando fica pronto e, no fim, cada pessoa paga só o que pediu.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/conta" className={BUTTON.primaryLarge}>
            Criar conta grátis
          </Link>
          <a href="#como-funciona" className={ON_PHOTO}>
            Ver como funciona
          </a>
        </div>
        <p className="text-sm text-white/70">Sem cartão de crédito e sem app para instalar.</p>
      </div>
    </header>

    <main id="conteudo" className="flex flex-col">
      <section aria-label="Destaques" className="border-b border-border bg-card">
        <ul className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-3">
          {HIGHLIGHTS.map((highlight) => (
            <li key={highlight.title}>
              <p className="text-lg font-bold">{highlight.title}</p>
              <p className="mt-1 text-muted">{highlight.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="como-funciona" aria-labelledby="titulo-como-funciona" className="mx-auto w-full max-w-6xl scroll-mt-6 px-6 py-20">
        <p className="text-sm font-semibold tracking-widest text-accent uppercase">Como funciona</p>
        <h2 id="titulo-como-funciona" className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Do QR code à conta paga, todo mundo na mesma página
        </h2>
        <ol className="mt-14 flex flex-col gap-16 sm:gap-24">
          {STEPS.map((step, index) => (
            <li key={step.title} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
              <div className={cn("relative aspect-[4/3] overflow-hidden rounded-3xl shadow-xl", index % 2 === 1 && "md:order-2")}>
                <Image
                  src={step.image}
                  alt={step.alt}
                  fill
                  placeholder="blur"
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div>
                <p className="font-semibold text-accent">{step.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{step.title}</h3>
                <p className="mt-4 text-lg text-pretty text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="titulo-para-quem" className="bg-card">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-20 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="text-sm font-semibold tracking-widest text-accent uppercase">Para quem</p>
            <h2 id="titulo-para-quem" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Do bistrô ao boteco, da cafeteria ao bar de drinques
            </h2>
          </div>
          {[
            { image: bar, alt: "Bartender servindo um drinque num balcão com luz roxa", title: "Bares", text: "Drinques vão para a fila do bar, separados da cozinha. A turma divide a rodada sem discussão." },
            { image: cafe, alt: "Latte art numa xícara branca", title: "Cafeterias", text: "Pedido rápido no balcão ou na mesa, sem fila no caixa nas horas de pico." },
          ].map((place) => (
            <article key={place.title} className="relative isolate flex min-h-80 flex-col justify-end overflow-hidden rounded-3xl p-6 text-white">
              <Image src={place.image} alt={place.alt} fill placeholder="blur" sizes="(min-width: 768px) 50vw, 100vw" className="-z-20 object-cover" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent" aria-hidden="true" />
              <h3 className="text-2xl font-bold">{place.title}</h3>
              <p className="mt-1 max-w-md text-white/85">{place.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="titulo-gestao" className="mx-auto w-full max-w-6xl px-6 py-20">
        <p className="text-sm font-semibold tracking-widest text-accent uppercase">Para quem gerencia</p>
        <h2 id="titulo-gestao" className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Tudo o que o gerente precisa numa tela só
        </h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="rounded-2xl border border-border bg-card p-6">
              <p className="text-lg font-bold">{feature.title}</p>
              <p className="mt-1 text-muted">{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-comece" className="px-6 pb-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-3xl bg-accent p-8 text-on-accent sm:p-12">
          <h2 id="titulo-comece" className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Teste com o seu restaurante hoje
          </h2>
          <p className="max-w-2xl text-lg opacity-90">
            Crie a conta, cadastre o restaurante e ele já nasce com um salão e um cardápio de exemplo. Troque pelo seu,
            imprima os QR codes e chame a equipe.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/conta"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-on-accent px-6 font-semibold text-accent hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-accent"
            >
              Criar conta grátis
            </Link>
            <Link
              href="/conta"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-current px-6 font-semibold hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-accent"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>
    </main>

    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted sm:flex-row sm:justify-between">
        <p>{SITE_NAME} · pedidos pela mesa, comanda por pessoa.</p>
        <p className="flex flex-wrap gap-x-4">
          <Link href="/privacidade" className="underline hover:text-foreground">
            Privacidade
          </Link>
          <Link href="/termos" className="underline hover:text-foreground">
            Termos de uso
          </Link>
          <span>
            Fotos:{" "}
            <a href="https://unsplash.com" className="underline hover:text-foreground" rel="noopener noreferrer">
              Unsplash
            </a>
          </span>
        </p>
      </div>
    </footer>
  </>
);
