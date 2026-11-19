import type { NextRequest } from "next/server";
import { createCustomerCall } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";

export async function POST(request: NextRequest) {
  return handleCustomer(request, (identity, body, store) => createCustomerCall(store, identity, body));
}
