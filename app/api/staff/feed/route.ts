import type { NextRequest } from "next/server";
import { parseAfter } from "@/lib/api/body";
import { handleStaff } from "@/lib/api/http";
import { getStaffFeed } from "@/lib/api/staff";

export async function GET(request: NextRequest) {
  const after = parseAfter(request.nextUrl.searchParams.get("after"));
  return handleStaff(request, (_actor, _body, store) => getStaffFeed(store, after));
}
