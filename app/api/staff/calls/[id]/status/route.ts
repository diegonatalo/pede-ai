import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { setStaffCallStatus } from "@/lib/api/staff";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/calls/[id]/status">) {
  const { id: callId } = await ctx.params;
  return handleStaff(request, (actor, body, store) => setStaffCallStatus(store, actor, callId, body));
}
