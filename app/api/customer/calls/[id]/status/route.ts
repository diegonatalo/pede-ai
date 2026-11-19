import type { NextRequest } from "next/server";
import { setCustomerCallStatus } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/customer/calls/[id]/status">) {
  const { id: callId } = await ctx.params;
  return handleCustomer(request, (identity, body) => setCustomerCallStatus(getStore(), identity, callId, body));
}
