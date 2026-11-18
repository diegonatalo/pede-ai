import type {
  CallStatus,
  ItemStatus,
  Restaurant,
  Role,
  Tab,
  TabStatus,
} from "@/types/domain";

/**
 * Regras de mudança de estado: para cada estado, os próximos permitidos e quem pode fazer.
 * Funções puras, usadas pelos dois adaptadores (memória e Postgres) antes de gravar.
 */
type Rules<S extends string> = Record<S, Partial<Record<S, readonly Role[]>>>;

const STAFF = ["waiter", "manager"] as const;

const ITEM_RULES: Rules<ItemStatus> = {
  awaiting_approval: {
    sent: STAFF,
    canceled: ["customer", ...STAFF],
  },
  sent: {
    preparing: ["kitchen", "manager"],
    canceled: ["customer", ...STAFF],
  },
  preparing: {
    ready: ["kitchen", "manager"],
    // A cozinha começou o item errado e devolve para a fila.
    sent: ["kitchen", "manager"],
    canceled: STAFF,
  },
  ready: {
    picked_up: STAFF,
    // Marcado como pronto sem querer.
    preparing: ["kitchen", "manager"],
    canceled: STAFF,
  },
  picked_up: {
    delivered: STAFF,
    // O garçom pegou o item da mesa errada e devolve ao balcão.
    ready: STAFF,
    canceled: STAFF,
  },
  delivered: {},
  canceled: {},
};

const TAB_RULES: Rules<TabStatus> = {
  open: {
    bill_requested: ["customer", ...STAFF],
    paid: STAFF,
    canceled: ["manager"],
  },
  bill_requested: {
    // Pediu a conta e resolveu pedir mais alguma coisa.
    open: ["customer", ...STAFF],
    paid: STAFF,
    canceled: ["manager"],
  },
  paid: {},
  canceled: {},
};

const CALL_RULES: Rules<CallStatus> = {
  open: {
    acknowledged: STAFF,
    // O cliente desiste do chamado; o garçom resolve direto.
    resolved: ["customer", ...STAFF],
  },
  acknowledged: {
    resolved: STAFF,
  },
  resolved: {},
};

export type TransitionResult = { ok: true } | { ok: false; error: "invalid_transition" | "forbidden" };

const check = <S extends string>(rules: Rules<S>, from: S, to: S, role: Role): TransitionResult => {
  const allowed = rules[from][to];
  if (!allowed) return { ok: false, error: "invalid_transition" };
  if (!allowed.includes(role)) return { ok: false, error: "forbidden" };
  return { ok: true };
};

export const checkItemTransition = (from: ItemStatus, to: ItemStatus, role: Role) =>
  check(ITEM_RULES, from, to, role);

export const checkTabTransition = (from: TabStatus, to: TabStatus, role: Role) =>
  check(TAB_RULES, from, to, role);

export const checkCallTransition = (from: CallStatus, to: CallStatus, role: Role) =>
  check(CALL_RULES, from, to, role);

/** Próximos estados que o papel pode escolher (para montar os botões da tela). */
export const nextItemStatuses = (from: ItemStatus, role: Role): ItemStatus[] =>
  (Object.keys(ITEM_RULES[from]) as ItemStatus[]).filter((to) =>
    ITEM_RULES[from][to]?.includes(role),
  );

export const isFinalItemStatus = (status: ItemStatus) =>
  Object.keys(ITEM_RULES[status]).length === 0;

/** Estado com que os itens de um pedido novo nascem. */
export const initialItemStatus = (
  restaurant: Pick<Restaurant, "requireFirstOrderApproval">,
  tab: Pick<Tab, "approved">,
): ItemStatus =>
  restaurant.requireFirstOrderApproval && !tab.approved ? "awaiting_approval" : "sent";

/** A comanda aceita pedidos novos só enquanto está aberta. */
export const canOrder = (tab: Pick<Tab, "status">) => tab.status === "open";

/** A mesa só fecha quando todas as comandas foram pagas ou canceladas. */
export const canCloseSession = (tabs: Pick<Tab, "status">[]) =>
  tabs.every((tab) => tab.status === "paid" || tab.status === "canceled");
