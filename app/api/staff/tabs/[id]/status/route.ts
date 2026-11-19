import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { setStaffTabStatus } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/tabs/[id]/status">) {
  const { id: tabId } = await ctx.params;
  return handleStaff(request, (role, body) => setStaffTabStatus(getStore(), role, tabId, body));
}
