import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { closeTable } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/sessions/[id]/close">) {
  const { id: sessionId } = await ctx.params;
  return handleStaff(request, (actor) => closeTable(getStore(), actor, sessionId));
}
