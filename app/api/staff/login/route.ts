import type { NextRequest } from "next/server";
import { handleStaffSession } from "@/lib/api/http";
import { staffLogin } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  return handleStaffSession(request, (identity, body) => staffLogin(getStore(), identity, body, Date.now()));
}
