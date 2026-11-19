import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { openTable } from "@/lib/api/staff";

export async function POST(request: NextRequest) {
  return handleStaff(request, (actor, body, store) => openTable(store, actor, body));
}
