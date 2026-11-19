import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { setTeamActive } from "@/lib/api/staff";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/team/[id]/active">) {
  const { id: staffId } = await ctx.params;
  return handleStaff(request, (actor, body, store) => setTeamActive(store, actor, staffId, body));
}
