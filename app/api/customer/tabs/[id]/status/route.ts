import type { NextRequest } from "next/server";
import { setCustomerTabStatus } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/customer/tabs/[id]/status">) {
  const { id: tabId } = await ctx.params;
  return handleCustomer(request, (identity, body, store) => setCustomerTabStatus(store, identity, tabId, body));
}
