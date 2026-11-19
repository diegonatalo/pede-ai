import { connection, type NextRequest } from "next/server";
import { getTableStatus } from "@/lib/api/customer";
import { respond } from "@/lib/api/http";
import { getStore } from "@/lib/store";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/tables/[id]">) {
  await connection();
  const { id: tableId } = await ctx.params;
  return respond(await getTableStatus(getStore(), tableId));
}
