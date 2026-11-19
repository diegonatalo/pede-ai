import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { createStaffTab } from "@/lib/api/staff";

export async function POST(request: NextRequest) {
  return handleStaff(request, (actor, body, store) => createStaffTab(store, actor, body));
}
