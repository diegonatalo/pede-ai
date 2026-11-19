import { computeTabBill } from "@/lib/billing";
import { sumCents } from "@/lib/money";
import type { Cents, Restaurant } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

export type DayReport = {
  /** Total das comandas pagas, com taxa e couvert. */
  revenueCents: Cents;
  paidTabs: number;
  peopleServed: number;
  averagePerPersonCents: Cents;
  openTables: number;
  closedTables: number;
  itemsSold: number;
  canceledItems: number;
  /** Do início do preparo até ficar pronto. `null` sem dados. */
  averagePrepMinutes: number | null;
  /** Do pedido ir para a cozinha até chegar à mesa. `null` sem dados. */
  averageServeMinutes: number | null;
  topItems: { name: string; quantity: number }[];
};

/** Meia-noite do dia de `date` no fuso do aparelho, em ISO (UTC). */
export const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();

const minutesBetween =(from: string | undefined, to: string | undefined) =>
  from && to ? (Date.parse(to) - Date.parse(from)) / 60_000 : null;

const average = (values: number[]) =>
  values.length === 0 ? null : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;

/**
 * Números do dia a partir das mesas abertas e fechadas no período.
 * O faturamento usa a taxa e o couvert atuais do restaurante (a demo não guarda o histórico deles).
 */
export const computeDayReport = (
  sessions: SessionSnapshot[],
  restaurant: Pick<Restaurant, "serviceFeePercent" | "couvertCents">,
): DayReport => {
  const paid = sessions.flatMap((session) =>
    session.tabs.filter((tab) => tab.status === "paid").map((tab) => ({ tab, session })),
  );
  const revenueCents = sumCents(paid.map(({ tab, session }) => computeTabBill(tab, session.items, restaurant).totalCents));
  const peopleServed = paid.reduce((sum, { tab }) => sum + tab.peopleCount, 0);

  const items = sessions.flatMap((session) => session.items);
  const sold = items.filter((item) => item.status !== "canceled");

  const quantities = new Map<string, number>();
  for (const item of sold) quantities.set(item.nameSnapshot, (quantities.get(item.nameSnapshot) ?? 0) + item.quantity);
  const topItems = [...quantities]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 5);

  const prep = items
    .map((item) => minutesBetween(item.timeline.preparing, item.timeline.ready))
    .filter((value): value is number => value !== null && value >= 0);
  const serve = items
    .map((item) => minutesBetween(item.timeline.sent, item.timeline.delivered))
    .filter((value): value is number => value !== null && value >= 0);

  return {
    revenueCents,
    paidTabs: paid.length,
    peopleServed,
    averagePerPersonCents: peopleServed > 0 ? Math.round(revenueCents / peopleServed) : 0,
    openTables: sessions.filter((session) => session.session.status === "open").length,
    closedTables: sessions.filter((session) => session.session.status === "closed").length,
    itemsSold: sold.reduce((sum, item) => sum + item.quantity, 0),
    canceledItems: items.filter((item) => item.status === "canceled").length,
    averagePrepMinutes: average(prep),
    averageServeMinutes: average(serve),
    topItems,
  };
};
