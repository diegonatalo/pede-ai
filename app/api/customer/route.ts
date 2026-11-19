import type { NextRequest } from "next/server";
import { getCustomerView } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";
import { getStore } from "@/lib/store";

export async function GET(request: NextRequest) {
  return handleCustomer(request, (identity) => getCustomerView(getStore(), identity));
}
