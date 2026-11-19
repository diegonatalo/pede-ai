import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { resetTeamPin } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/team/[id]/pin">) {
  const { id: staffId } = await ctx.params;
  return handleStaff(request, (actor) => resetTeamPin(getStore(), actor, staffId));
}
