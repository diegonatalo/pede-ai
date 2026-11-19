import type { NextRequest } from "next/server";
import { placeCustomerOrder } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";

export async function POST(request: NextRequest) {
  return handleCustomer(request, (identity, body, store) => placeCustomerOrder(store, identity, body));
}
