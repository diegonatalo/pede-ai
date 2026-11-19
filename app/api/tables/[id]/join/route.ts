import type { NextRequest } from "next/server";
import { joinTable } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/join">) {
  const { id: tableId } = await ctx.params;
  return handleCustomer(request, (identity, body, store) => joinTable(store, identity, tableId, body, Date.now()));
}
