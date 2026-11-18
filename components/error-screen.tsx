"use client";

import { useEffect } from "react";
import Link from "next/link";

type ErrorScreenProps = {
  error: unknown;
  retry: () => void;
};

export const ErrorScreen = ({ error, retry }: ErrorScreenProps) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Algo deu errado</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Esta página encontrou um erro inesperado. Tente de novo ou volte para o início.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="h-11 rounded-full bg-foreground px-5 font-medium text-background hover:opacity-90"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="flex h-11 items-center rounded-full border border-black/[.08] px-5 font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
};
