import { computeSessionBills, type TabBill } from "@/lib/billing";
import { canCloseSession } from "@/lib/transitions";
import type { OrderItem, Restaurant, Tab, Table, WaiterCall } from "@/types/domain";
import type { SessionSnapshot } from "@/types/store";

/** Filas das telas da equipe, montadas a partir das mesas abertas. Funções puras. */

const tabOf = (session: SessionSnapshot, item: OrderItem): Tab | undefined => {
  const order = session.orders.find((entry) => entry.id === item.orderId);
  return session.tabs.find((tab) => tab.id === order?.tabId);
};

export type ApprovalRequest = { session: SessionSnapshot; tab: Tab; items: OrderItem[] };

/** Comandas com primeiro pedido esperando o garçom, da mais antiga para a mais nova. */
export const pendingApprovals = (sessions: SessionSnapshot[]): ApprovalRequest[] =>
  sessions
    .flatMap((session) =>
      session.tabs
        .filter((tab) => !tab.approved)
        .map((tab) => ({
          session,
          tab,
          items: session.items.filter(
            (item) => item.status === "awaiting_approval" && tabOf(session, item)?.id === tab.id,
          ),
        })),
    )
    .filter((request) => request.items.length > 0)
    .sort((a, b) => a.items[0].updatedAt.localeCompare(b.items[0].updatedAt));

export type PickupEntry = { table: Table; tabName: string; item: OrderItem };

/** Itens prontos no balcão e itens a caminho, do que ficou pronto há mais tempo. */
export const pickupQueue = (sessions: SessionSnapshot[]): PickupEntry[] =>
  sessions
    .flatMap((session) =>
      session.items
        .filter((item) => item.status === "ready" || item.status === "picked_up")
        .map((item) => ({ table: session.table, tabName: tabOf(session, item)?.customerName ?? "", item })),
    )
    .sort((a, b) => a.item.updatedAt.localeCompare(b.item.updatedAt));

export type CallEntry = { table: Table; tabName?: string; call: WaiterCall };

/** Chamados ainda não resolvidos, do mais antigo para o mais novo. */
export const activeCalls = (sessions: SessionSnapshot[]): CallEntry[] =>
  sessions
    .flatMap((session) =>
      session.calls
        .filter((call) => call.status !== "resolved")
        .map((call) => ({
          table: session.table,
          tabName: session.tabs.find((tab) => tab.id === call.tabId)?.customerName,
          call,
        })),
    )
    .sort((a, b) => a.call.createdAt.localeCompare(b.call.createdAt));

/** Quantas coisas pedem a atenção do garçom agora (para o aviso sonoro e o selo da aba). */
export const waiterAttention = (sessions: SessionSnapshot[]) =>
  pendingApprovals(sessions).length +
  pickupQueue(sessions).filter((entry) => entry.item.status === "ready").length +
  activeCalls(sessions).filter((entry) => entry.call.status === "open").length;

export type TableSummary = {
  table: Table;
  session?: SessionSnapshot;
  joinCode?: string;
  bills: TabBill[];
  totalCents: number;
  billRequested: boolean;
  needsApproval: boolean;
  canClose: boolean;
};

/** Situação de cada mesa do salão, na ordem do cadastro. */
export const tableBoard = (
  tables: Table[],
  sessions: SessionSnapshot[],
  restaurant: Pick<Restaurant, "serviceFeePercent" | "couvertCents">,
  joinCodes: Record<string, string>,
): TableSummary[] =>
  tables.map((table) => {
    const session = sessions.find((entry) => entry.table.id === table.id);
    if (!session) {
      return { table, bills: [], totalCents: 0, billRequested: false, needsApproval: false, canClose: false };
    }
    const { bills, totalCents } = computeSessionBills(session.tabs, session.items, restaurant);
    return {
      table,
      session,
      joinCode: joinCodes[session.session.id],
      bills,
      totalCents,
      billRequested: session.tabs.some((tab) => tab.status === "bill_requested"),
      needsApproval: pendingApprovals([session]).length > 0,
      canClose: canCloseSession(session.tabs),
    };
  });

/** Minutos inteiros desde `iso` (0 se for no futuro). */
export const minutesSince = (iso: string, nowMs: number) =>
  Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 60_000));
