import type { ItemRow, TabRow } from "@/lib/report-rows";

/**
 * CSV no jeito que o Excel em português abre direto: separador ";", vírgula decimal e BOM
 * (para os acentos saírem certos). O Google Planilhas também lê.
 */
const SEPARATOR = ";";
const BOM = "﻿";

const cell = (value: string | number) => {
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Centavos em reais, sem o "R$": 1250 → "12,50". */
export const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export const toCsv = (header: string[], rows: (string | number)[][]) =>
  BOM + [header, ...rows].map((row) => row.map(cell).join(SEPARATOR)).join("\r\n") + "\r\n";

/** Data e hora locais, separadas, para filtrar e ordenar na planilha. */
const dateTime = (iso: string, timeZone?: string) => {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
  return [day, time];
};

export const itemsCsv = (rows: ItemRow[], timeZone?: string) =>
  toCsv(
    ["Data", "Hora", "Mesa", "Comanda", "Item", "Preparo", "Quantidade", "Preço unitário (R$)", "Total (R$)", "Situação"],
    rows.map((row) => [
      ...dateTime(row.orderedAt, timeZone),
      row.table,
      row.tab,
      row.item,
      row.station,
      row.quantity,
      csvMoney(row.unitPriceCents),
      csvMoney(row.totalCents),
      row.status,
    ]),
  );

export const tabsCsv = (rows: TabRow[], timeZone?: string) =>
  toCsv(
    ["Data", "Hora", "Mesa", "Comanda", "Pessoas", "Situação", "Itens (R$)", "Taxa de serviço (R$)", "Couvert (R$)", "Total (R$)"],
    rows.map((row) => [
      ...dateTime(row.openedAt, timeZone),
      row.table,
      row.tab,
      row.people,
      row.status,
      csvMoney(row.itemsCents),
      csvMoney(row.serviceFeeCents),
      csvMoney(row.couvertCents),
      csvMoney(row.totalCents),
    ]),
  );
