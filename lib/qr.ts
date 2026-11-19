import { toString } from "qrcode";

/** Endereço que o QR da mesa abre: a tela do cliente daquela mesa, no restaurante. */
export const tableUrl = (origin: string, slug: string, tableId: string) =>
  `${origin.replace(/\/+$/, "")}/r/${encodeURIComponent(slug)}/mesa/${encodeURIComponent(tableId)}`;

/**
 * QR em SVG. Correção de erros "M" (aguenta uns 15% do código sujo ou riscado, comum em mesa)
 * e margem padrão de 4 módulos, que os leitores de celular precisam.
 */
export const qrSvg = (text: string) =>
  toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: { dark: "#000000", light: "#ffffff" } });
