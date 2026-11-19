import type { NextRequest } from "next/server";
import { parseAfter } from "@/lib/api/body";
import { handleStaff } from "@/lib/api/http";
import { getStaffFeed } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function GET(request: NextRequest) {
  const after = parseAfter(request.nextUrl.searchParams.get("after"));
  return handleStaff(request, () => getStaffFeed(getStore(), after));
}
