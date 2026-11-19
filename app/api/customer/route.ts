import type { NextRequest } from "next/server";
import { getCustomerView } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";

export async function GET(request: NextRequest) {
  return handleCustomer(request, (identity, _body, store) => getCustomerView(store, identity));
}
