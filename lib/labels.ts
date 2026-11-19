import type { CallReason, CallStatus, ItemStatus, Station, TabStatus } from "@/types/domain";

/** Textos exibidos para cada estado, do ponto de vista do cliente. */
export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  awaiting_approval: "Aguardando o garçom",
  sent: "Na fila",
  preparing: "Em preparo",
  ready: "Pronto",
  picked_up: "A caminho",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export const TAB_STATUS_LABEL: Record<TabStatus, string> = {
  open: "Aberta",
  bill_requested: "Conta pedida",
  paid: "Paga",
  canceled: "Cancelada",
};

export const CALL_REASON_LABEL: Record<CallReason, string> = {
  question: "Tirar uma dúvida",
  bill: "Pedir a conta",
  other: "Outro assunto",
};

export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  open: "Chamando",
  acknowledged: "O garçom está a caminho",
  resolved: "Atendido",
};

export const STATION_LABEL: Record<Station, string> = {
  kitchen: "Cozinha",
  bar: "Bar",
};
