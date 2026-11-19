import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { getManagerReport } from "@/lib/api/staff";

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get("since");
  return handleStaff(request, (actor, _body, store) => getManagerReport(store, actor, since));
}
