import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { setStaffItemShares } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/items/[id]/shares">) {
  const { id: itemId } = await ctx.params;
  return handleStaff(request, (role, body) => setStaffItemShares(getStore(), role, itemId, body));
}
