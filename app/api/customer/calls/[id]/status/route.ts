import type { NextRequest } from "next/server";
import { setCustomerCallStatus } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/customer/calls/[id]/status">) {
  const { id: callId } = await ctx.params;
  return handleCustomer(request, (identity, body, store) => setCustomerCallStatus(store, identity, callId, body));
}
