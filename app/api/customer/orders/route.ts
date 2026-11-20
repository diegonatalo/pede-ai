import type { NextRequest } from "next/server";
import { placeCustomerOrder } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";
import { notifyStaff } from "@/lib/api/notify";
import { approvalMessage } from "@/lib/push";
import type { Order, OrderItem } from "@/types/domain";

export async function POST(request: NextRequest) {
  return handleCustomer(request, async (identity, body, store) => {
    const result = await placeCustomerOrder(store, identity, body);
    const placed = result.body as { order?: Order; items?: OrderItem[] };
    // Primeiro pedido da comanda: o garçom precisa confirmar.
    if (result.status === 200 && identity && placed.order && placed.items?.some((item) => item.status === "awaiting_approval")) {
      const { order } = placed;
      notifyStaff(store, async (slug) => {
        const snapshot = await store.getSessionSnapshot(identity.sessionId);
        return snapshot.ok ? approvalMessage(snapshot.value, order.tabId, slug) : null;
      });
    }
    return result;
  });
}
