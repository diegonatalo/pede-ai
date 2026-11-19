import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { getManagerReport } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get("since");
  return handleStaff(request, (actor) => getManagerReport(getStore(), actor, since));
}
