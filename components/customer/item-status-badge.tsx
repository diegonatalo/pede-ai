import { cn } from "@/lib/cn";
import { ITEM_STATUS_LABEL } from "@/lib/labels";
import type { ItemStatus } from "@/types/domain";

// Cor reforça, mas o texto é que informa: nada depende só da cor.
const TONE: Record<ItemStatus, string> = {
  awaiting_approval: "bg-warning-soft text-warning",
  sent: "bg-surface text-muted",
  preparing: "bg-accent-soft text-accent",
  ready: "bg-success-soft text-success",
  picked_up: "bg-info-soft text-info",
  delivered: "bg-success text-card",
  canceled: "bg-surface text-muted line-through",
};

export const ItemStatusBadge = ({ status }: { status: ItemStatus }) => (
  <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[status])}>
    {ITEM_STATUS_LABEL[status]}
  </span>
);
