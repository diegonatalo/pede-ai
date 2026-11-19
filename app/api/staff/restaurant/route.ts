import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { updateSettings } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function PATCH(request: NextRequest) {
  return handleStaff(request, (role, body) => updateSettings(getStore(), role, body));
}
