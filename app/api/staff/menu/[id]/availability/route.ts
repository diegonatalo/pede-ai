import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { setAvailability } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/staff/menu/[id]/availability">) {
  const { id: menuItemId } = await ctx.params;
  return handleStaff(request, (role, body) => setAvailability(getStore(), role, menuItemId, body));
}
