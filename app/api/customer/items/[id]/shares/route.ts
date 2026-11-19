import type { NextRequest } from "next/server";
import { setCustomerItemShares } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/customer/items/[id]/shares">) {
  const { id: itemId } = await ctx.params;
  return handleCustomer(request, (identity, body) => setCustomerItemShares(getStore(), identity, itemId, body));
}
