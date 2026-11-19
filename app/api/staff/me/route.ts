import type { NextRequest } from "next/server";
import { handleStaffSession } from "@/lib/api/http";
import { success } from "@/lib/api/result";

export async function GET(request: NextRequest) {
  return handleStaffSession(request, (identity) => success({ roles: identity?.roles ?? [] }));
}
