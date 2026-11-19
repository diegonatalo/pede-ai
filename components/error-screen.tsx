"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AmbientGlow, BrandMark } from "@/components/ui/brand";
import { BUTTON } from "@/components/ui/styles";

type ErrorScreenProps = {
  error: unknown;
  retry: () => void;
};

export const ErrorScreen = ({ error, retry }: ErrorScreenProps) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative isolate flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <AmbientGlow />
      <BrandMark />
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Algo deu errado</h1>
      <p className="max-w-md text-muted">Esta página encontrou um erro inesperado. Tente de novo ou volte para o início.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className={BUTTON.primary}>
          Tentar de novo
        </button>
        <Link href="/" className={BUTTON.secondary}>
          Voltar ao início
        </Link>
      </div>
    </main>
  );
};
