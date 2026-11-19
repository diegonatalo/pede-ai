import type { ItemShare, OrderItem, Tab } from "@/types/domain";

/** Rascunho da divisão de um item: partes por comanda (0 = fora da divisão). */
export type SplitDraft = Record<string, number>;

export const MAX_PARTS = 10;

/** Comandas que podem entrar numa divisão: abertas ou com a conta pedida. */
export const splittableTabs = <T extends Pick<Tab, "id" | "status">>(tabs: T[]) =>
  tabs.filter((tab) => tab.status === "open" || tab.status === "bill_requested");

/** Começa da divisão atual do item; comandas de fora entram com 0. */
export const draftFromItem = (item: Pick<OrderItem, "shares">, tabs: Pick<Tab, "id">[]): SplitDraft => {
  const draft: SplitDraft = {};
  for (const tab of tabs) draft[tab.id] = item.shares.find((share) => share.tabId === tab.id)?.parts ?? 0;
  return draft;
};

/** Liga/desliga uma comanda (entra com 1 parte) ou muda as partes, sempre entre 0 e o máximo. */
export const setParts = (draft: SplitDraft, tabId: string, parts: number): SplitDraft => ({
  ...draft,
  [tabId]: Math.max(0, Math.min(MAX_PARTS, Math.round(parts))),
});

/** Divisões para a API, na ordem das comandas; a primeira leva os centavos que sobram. */
export const draftToShares = (draft: SplitDraft, tabs: Pick<Tab, "id">[]): ItemShare[] =>
  tabs.filter((tab) => (draft[tab.id] ?? 0) > 0).map((tab) => ({ tabId: tab.id, parts: draft[tab.id] }));

/**
 * Texto curto da divisão, do ponto de vista de uma comanda:
 * "Só desta comanda", "Dividido com Lia", "Dividido com Lia e Bia (sua parte: 2 de 4)".
 */
export const describeSplit = (
  item: Pick<OrderItem, "shares">,
  tabs: Pick<Tab, "id" | "customerName">[],
  viewerTabId: string,
): string => {
  const others = item.shares.filter((share) => share.tabId !== viewerTabId);
  if (others.length === 0) return "Só desta comanda";
  const names = others.map((share) => tabs.find((tab) => tab.id === share.tabId)?.customerName ?? "outra comanda");
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
  const total = item.shares.reduce((sum, share) => sum + share.parts, 0);
  const mine = item.shares.find((share) => share.tabId === viewerTabId)?.parts ?? 0;
  const equal = item.shares.every((share) => share.parts === item.shares[0].parts);
  return equal && mine > 0 ? `Dividido com ${list}` : `Dividido com ${list} (sua parte: ${mine} de ${total})`;
};
