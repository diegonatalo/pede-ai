import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { approveTab } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/tabs/[id]/approve">) {
  const { id: tabId } = await ctx.params;
  return handleStaff(request, (actor) => approveTab(getStore(), actor, tabId));
}
