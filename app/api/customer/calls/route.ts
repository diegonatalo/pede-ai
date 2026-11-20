import type { NextRequest } from "next/server";
import { createCustomerCall } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";
import { notifyStaff } from "@/lib/api/notify";
import { callMessage } from "@/lib/push";
import type { WaiterCall } from "@/types/domain";

export async function POST(request: NextRequest) {
  return handleCustomer(request, async (identity, body, store) => {
    const result = await createCustomerCall(store, identity, body);
    if (result.status === 200 && identity) {
      const call = result.body as WaiterCall;
      notifyStaff(store, async (slug) => {
        const snapshot = await store.getSessionSnapshot(identity.sessionId);
        return snapshot.ok ? callMessage(snapshot.value, call, slug) : null;
      });
    }
    return result;
  });
}
