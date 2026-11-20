import Link from "next/link";
import { BrandMark } from "@/components/ui/brand";

/** Estilo dos links dentro do texto de `/privacidade` e `/termos`. */
export const linkClass = "font-semibold text-accent underline-offset-2 hover:underline";

/** Marca do Pede Aí no topo das páginas legais, com link para o início. */
export const HomeBrandLink = () => (
  <Link
    href="/"
    className="mb-8 inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    aria-label="Pede Aí, voltar ao início"
  >
    <BrandMark />
  </Link>
);
