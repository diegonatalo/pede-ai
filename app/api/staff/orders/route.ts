import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { placeStaffOrder } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  return handleStaff(request, (actor, body) => placeStaffOrder(getStore(), actor, body));
}
