import { percentOf, sumCents } from "@/lib/money";
import type { Cents, ItemShare, OrderItem, Restaurant, Tab } from "@/types/domain";

/**
 * Divide um valor em centavos conforme os pesos, sem perder nem criar centavos.
 * Cada parte recebe o piso da sua fração; os centavos que sobram vão, um por vez,
 * para as primeiras partes. Ex.: 1000 em [1, 1, 1] → [334, 333, 333].
 */
export const allocateCents = (total: Cents, weights: number[]): Cents[] => {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) throw new Error("allocateCents: a soma dos pesos precisa ser positiva");

  const shares = weights.map((weight) => Math.floor((total * weight) / weightSum));
  let leftover = total - sumCents(shares);
  for (let index = 0; leftover > 0; index = (index + 1) % shares.length) {
    if (weights[index] > 0) {
      shares[index] += 1;
      leftover -= 1;
    }
  }
  return shares;
};

export type SharesError = "empty" | "invalid_parts" | "duplicate_tab" | "unknown_tab";

/** Confere a divisão de um item antes de gravar. `null` quando está tudo certo. */
export const validateShares = (shares: ItemShare[], tabIds: string[]): SharesError | null => {
  if (shares.length === 0) return "empty";
  if (shares.some((share) => !Number.isInteger(share.parts) || share.parts < 1)) return "invalid_parts";
  if (new Set(shares.map((share) => share.tabId)).size !== shares.length) return "duplicate_tab";
  const known = new Set(tabIds);
  if (shares.some((share) => !known.has(share.tabId))) return "unknown_tab";
  return null;
};

export const itemTotal = (item: Pick<OrderItem, "unitPriceCents" | "quantity">): Cents =>
  item.unitPriceCents * item.quantity;

/** Quanto do item cabe a cada comanda, na ordem das partes. */
export const allocateItem = (item: OrderItem): { tabId: string; amountCents: Cents }[] => {
  const amounts = allocateCents(
    itemTotal(item),
    item.shares.map((share) => share.parts),
  );
  return item.shares.map((share, index) => ({ tabId: share.tabId, amountCents: amounts[index] }));
};

export type BillLine = {
  itemId: string;
  name: string;
  quantity: number;
  /** Partes desta comanda e total de partes do item: 1 de 1 quando não foi dividido. */
  parts: number;
  totalParts: number;
  amountCents: Cents;
  /** O item ainda não chegou à mesa. */
  pending: boolean;
};

export type TabBill = {
  tabId: string;
  lines: BillLine[];
  subtotalCents: Cents;
  serviceFeeCents: Cents;
  couvertCents: Cents;
  totalCents: Cents;
  pendingCount: number;
};

type BillConfig = Pick<Restaurant, "serviceFeePercent" | "couvertCents">;

/**
 * Conta de uma comanda: itens próprios e partes de itens divididos (cancelados ficam de fora),
 * taxa de serviço sobre os itens e couvert por pessoa (sem taxa).
 */
export const computeTabBill = (
  tab: Pick<Tab, "id" | "peopleCount">,
  items: OrderItem[],
  config: BillConfig,
): TabBill => {
  const lines: BillLine[] = [];

  for (const item of items) {
    if (item.status === "canceled") continue;
    const share = item.shares.find((entry) => entry.tabId === tab.id);
    if (!share) continue;
    const allocation = allocateItem(item).find((entry) => entry.tabId === tab.id);
    lines.push({
      itemId: item.id,
      name: item.nameSnapshot,
      quantity: item.quantity,
      parts: share.parts,
      totalParts: item.shares.reduce((sum, entry) => sum + entry.parts, 0),
      amountCents: allocation?.amountCents ?? 0,
      pending: item.status !== "delivered",
    });
  }

  const subtotalCents = sumCents(lines.map((line) => line.amountCents));
  const serviceFeeCents = percentOf(subtotalCents, config.serviceFeePercent);
  const couvertCents = config.couvertCents * tab.peopleCount;

  return {
    tabId: tab.id,
    lines,
    subtotalCents,
    serviceFeeCents,
    couvertCents,
    totalCents: subtotalCents + serviceFeeCents + couvertCents,
    pendingCount: lines.filter((line) => line.pending).length,
  };
};

/** Contas de todas as comandas da mesa, para o garçom e o gerente. */
export const computeSessionBills = (
  tabs: Pick<Tab, "id" | "peopleCount" | "status">[],
  items: OrderItem[],
  config: BillConfig,
): { bills: TabBill[]; totalCents: Cents } => {
  const bills = tabs
    .filter((tab) => tab.status !== "canceled")
    .map((tab) => computeTabBill(tab, items, config));
  return { bills, totalCents: sumCents(bills.map((bill) => bill.totalCents)) };
};
