"use client";

import { useEffect, useState } from "react";
import { BUTTON, CARD } from "@/components/ui/styles";
import { useRestaurantSlug } from "@/hooks/use-restaurant";
import { qrSvg, tableUrl } from "@/lib/qr";
import type { Table } from "@/types/domain";

type Props = { tables: Pick<Table, "id" | "label">[] };

type Code = { tableId: string; url: string; svg: string };

const isLocal = (origin: string) => /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(origin);

/**
 * Um cartão por mesa com o QR que abre a tela do cliente, pronto para imprimir e colar na mesa.
 * Os links usam o endereço do site aberto: imprima pela versão publicada.
 */
export const QrSheet = ({ tables }: Props) => {
  const slug = useRestaurantSlug();
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    let active = true;
    // O endereço só existe no navegador; o QR é gerado depois da hidratação.
    const here = window.location.origin;
    void Promise.all(
      tables.map(async (table) => {
        const url = tableUrl(here, slug, table.id);
        return { tableId: table.id, url, svg: await qrSvg(url) };
      }),
    ).then((generated) => {
      if (!active) return;
      setOrigin(here);
      setCodes(generated);
    });
    return () => {
      active = false;
    };
  }, [slug, tables]);

  if (!codes) {
    return (
      <p className="text-muted" role="status">
        Gerando os QR codes…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="max-w-xl text-muted">
          Imprima, recorte e cole um em cada mesa. O cliente aponta a câmera, abre a mesa e digita o código que o
          garçom passar.
        </p>
        <button type="button" className={BUTTON.primary} onClick={() => window.print()}>
          Imprimir
        </button>
      </div>
      {isLocal(origin) && (
        <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-900/40 dark:text-amber-50 print:hidden" role="alert">
          Estes QR codes apontam para {origin}, que só funciona neste computador. Para imprimir os de verdade, abra
          esta tela pelo endereço publicado.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-6">
        {codes.map((code) => {
          const label = tables.find((table) => table.id === code.tableId)?.label ?? code.tableId;
          return (
            <li
              key={code.tableId}
              className={`${CARD} flex break-inside-avoid flex-col items-center gap-2 p-5 text-center print:border-black print:bg-white print:text-black`}
            >
              <p className="text-sm font-semibold tracking-wide uppercase">Peça pelo celular</p>
              <div
                className="w-48 max-w-full rounded-lg bg-white p-1"
                role="img"
                aria-label={`QR code da ${label}`}
                // SVG gerado aqui mesmo pela biblioteca qrcode, a partir do endereço da mesa.
                dangerouslySetInnerHTML={{ __html: code.svg }}
              />
              <h3 className="text-2xl font-bold">{label}</h3>
              <p className="text-xs break-all text-muted print:text-black">{code.url}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
