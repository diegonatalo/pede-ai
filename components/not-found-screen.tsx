import Link from "next/link";

export const NotFoundScreen = () => (
  <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
    <p className="text-7xl font-bold text-accent" aria-hidden="true">
      404
    </p>
    <h1 className="text-3xl font-semibold tracking-tight">Página não encontrada</h1>
    <p className="max-w-md text-muted">
      Esse endereço não existe. Se você veio pelo QR code da mesa, peça ajuda ao garçom.
    </p>
    <Link
      href="/"
      className="mt-4 flex h-11 items-center rounded-full bg-accent px-5 font-medium text-on-accent hover:opacity-90"
    >
      Voltar ao início
    </Link>
  </main>
);
