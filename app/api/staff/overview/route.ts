import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { getStaffOverview } from "@/lib/api/staff";

export async function GET(request: NextRequest) {
  return handleStaff(request, (actor, _body, store) => getStaffOverview(store, actor));
}
