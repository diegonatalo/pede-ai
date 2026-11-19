import type { NextRequest } from "next/server";
import { parseAfter } from "@/lib/api/body";
import { getCustomerFeed } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";
import { getStore } from "@/lib/store";

export async function GET(request: NextRequest) {
  const after = parseAfter(request.nextUrl.searchParams.get("after"));
  return handleCustomer(request, (identity) => getCustomerFeed(getStore(), identity, after));
}
