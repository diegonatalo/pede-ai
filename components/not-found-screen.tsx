import Link from "next/link";
import { AmbientGlow, BrandMark } from "@/components/ui/brand";
import { BUTTON } from "@/components/ui/styles";

export const NotFoundScreen = () => (
  <main className="relative isolate flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
    <AmbientGlow />
    <BrandMark />
    <p className="mt-4 font-display text-8xl font-bold tracking-tight text-accent" aria-hidden="true">
      404
    </p>
    <h1 className="text-3xl font-bold tracking-tight">Página não encontrada</h1>
    <p className="max-w-md text-muted">
      Esse endereço não existe. Se você veio pelo QR code da mesa, peça ajuda ao garçom.
    </p>
    <Link href="/" className={`${BUTTON.primary} mt-4`}>
      Voltar ao início
    </Link>
  </main>
);
