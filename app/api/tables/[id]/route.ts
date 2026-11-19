import type { NextRequest } from "next/server";
import { getTableStatus } from "@/lib/api/customer";
import { handlePublic } from "@/lib/api/http";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/tables/[id]">) {
  const { id: tableId } = await ctx.params;
  return handlePublic(request, (store) => getTableStatus(store, tableId));
}
