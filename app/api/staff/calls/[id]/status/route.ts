import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { setStaffCallStatus } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/calls/[id]/status">) {
  const { id: callId } = await ctx.params;
  return handleStaff(request, (actor, body) => setStaffCallStatus(getStore(), actor, callId, body));
}
