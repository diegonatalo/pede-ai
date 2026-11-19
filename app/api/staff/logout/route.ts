import type { NextRequest } from "next/server";
import { handleStaffSession } from "@/lib/api/http";
import { staffLogout } from "@/lib/api/staff";

export async function POST(request: NextRequest) {
  return handleStaffSession(request, (identity, body, restaurant) => staffLogout(identity, body, restaurant.id));
}
