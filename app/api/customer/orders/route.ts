import type { NextRequest } from "next/server";
import { placeCustomerOrder } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";
import { getStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  return handleCustomer(request, (identity, body) => placeCustomerOrder(getStore(), identity, body));
}
