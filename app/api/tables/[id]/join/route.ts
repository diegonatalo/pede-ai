import type { NextRequest } from "next/server";
import { joinTable } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/join">) {
  const { id: tableId } = await ctx.params;
  return handleCustomer(request, (identity, body) => joinTable(getStore(), identity, tableId, body, Date.now()));
}
