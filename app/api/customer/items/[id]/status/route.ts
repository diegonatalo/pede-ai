import type { NextRequest } from "next/server";
import { setCustomerItemStatus } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/customer/items/[id]/status">) {
  const { id: itemId } = await ctx.params;
  return handleCustomer(request, (identity, body, store) => setCustomerItemStatus(store, identity, itemId, body));
}
