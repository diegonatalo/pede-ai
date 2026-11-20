import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { notifyStaff } from "@/lib/api/notify";
import { setStaffItemStatus } from "@/lib/api/staff";
import { readyMessage } from "@/lib/push";
import type { OrderItem } from "@/types/domain";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/items/[id]/status">) {
  const { id: itemId } = await ctx.params;
  return handleStaff(request, async (actor, body, store) => {
    const result = await setStaffItemStatus(store, actor, itemId, body);
    const item = result.body as OrderItem;
    // Ficou pronto: o garçom vai buscar.
    if (result.status === 200 && item.status === "ready") {
      notifyStaff(store, async (slug) => {
        const snapshot = (await store.listOpenSessions()).find((entry) => entry.items.some((entry) => entry.id === item.id));
        return snapshot ? readyMessage(snapshot, item, slug) : null;
      });
    }
    return result;
  });
}
