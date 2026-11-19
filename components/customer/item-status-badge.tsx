import { cn } from "@/lib/cn";
import { ITEM_STATUS_LABEL } from "@/lib/labels";
import type { ItemStatus } from "@/types/domain";

// Cor reforça, mas o texto é que informa: nada depende só da cor.
const TONE: Record<ItemStatus, string> = {
  awaiting_approval: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  sent: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100",
  preparing: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100",
  ready: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  picked_up: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  delivered: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
  canceled: "bg-stone-100 text-stone-500 line-through dark:bg-stone-800 dark:text-stone-400",
};

export const ItemStatusBadge = ({ status }: { status: ItemStatus }) => (
  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[status])}>
    {ITEM_STATUS_LABEL[status]}
  </span>
);
