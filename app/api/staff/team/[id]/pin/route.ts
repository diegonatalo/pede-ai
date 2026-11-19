import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { resetTeamPin } from "@/lib/api/staff";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/team/[id]/pin">) {
  const { id: staffId } = await ctx.params;
  return handleStaff(request, (actor, _body, store) => resetTeamPin(store, actor, staffId));
}
