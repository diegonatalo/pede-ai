import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { approveTab } from "@/lib/api/staff";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/tabs/[id]/approve">) {
  const { id: tabId } = await ctx.params;
  return handleStaff(request, (actor, _body, store) => approveTab(store, actor, tabId));
}
