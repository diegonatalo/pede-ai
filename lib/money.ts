import type { Cents } from "@/types/domain";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 1050 → "R$ 10,50" (com espaço não separável, como o Intl gera). */
export const formatCents = (cents: Cents): string => BRL.format(cents / 100);

/**
 * Lê um valor digitado em reais e devolve centavos, ou `null` se não for válido.
 * Aceita "10", "10,5", "10,50", "R$ 1.234,56" e ponto como separador decimal ("10.50").
 */
export const parseCents = (input: string): Cents | null => {
  const text = input.replace(/R\$/i, "").replace(/\s/g, "");
  if (!text) return null;

  let normalized: string;
  if (text.includes(",")) {
    // Formato brasileiro: ponto é separador de milhar, vírgula é decimal.
    if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/.test(text)) return null;
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else {
    if (!/^\d+(\.\d{0,2})?$/.test(text)) return null;
    normalized = text;
  }

  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
};

/** Porcentagem de um valor, arredondada para o centavo mais próximo (meio para cima). */
export const percentOf = (cents: Cents, percent: number): Cents =>
  Math.round((cents * percent) / 100);

export const sumCents = (values: Cents[]): Cents => values.reduce((total, value) => total + value, 0);
