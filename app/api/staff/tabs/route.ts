import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { createStaffTab } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  return handleStaff(request, (role, body) => createStaffTab(getStore(), role, body));
}
