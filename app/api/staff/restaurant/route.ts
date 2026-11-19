import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { updateSettings } from "@/lib/api/staff";

export async function PATCH(request: NextRequest) {
  return handleStaff(request, (actor, body, store) => updateSettings(store, actor, body));
}
