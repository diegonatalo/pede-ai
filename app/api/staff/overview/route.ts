import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { getStaffOverview } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function GET(request: NextRequest) {
  return handleStaff(request, (actor) => getStaffOverview(getStore(), actor));
}
