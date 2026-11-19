import type { NextRequest } from "next/server";
import { handleStaffSession } from "@/lib/api/http";
import { rolesOf } from "@/lib/api/identity";
import { success } from "@/lib/api/result";

export async function GET(request: NextRequest) {
  return handleStaffSession(request, (identity, _body, restaurant) => success({ roles: rolesOf(identity, restaurant.id) }));
}
