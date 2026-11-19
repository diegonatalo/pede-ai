import type { NextRequest } from "next/server";
import { handleStaffSession } from "@/lib/api/http";
import { staffLogin } from "@/lib/api/staff";

export async function POST(request: NextRequest) {
  return handleStaffSession(request, (identity, body, restaurant) =>
    staffLogin(restaurant.store, identity, body, Date.now(), restaurant.id),
  );
}
