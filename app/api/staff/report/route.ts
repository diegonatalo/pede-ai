import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { getManagerReport } from "@/lib/api/staff";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return handleStaff(request, (actor, _body, store) =>
    getManagerReport(store, actor, params.get("since"), params.get("until")),
  );
}
