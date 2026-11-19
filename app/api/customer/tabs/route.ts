import type { NextRequest } from "next/server";
import { createCustomerTab } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  return handleCustomer(request, (identity, body) => createCustomerTab(getStore(), identity, body, Date.now()));
}
