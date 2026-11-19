import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { setStaffItemStatus } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/items/[id]/status">) {
  const { id: itemId } = await ctx.params;
  return handleStaff(request, (role, body) => setStaffItemStatus(getStore(), role, itemId, body));
}
