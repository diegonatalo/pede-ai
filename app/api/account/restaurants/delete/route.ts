import type { NextRequest } from "next/server";
import { deleteOwnRestaurant } from "@/lib/api/account";
import { handleAccount } from "@/lib/api/http";
import { getRegistry } from "@/lib/store";

export async function POST(request: NextRequest) {
  return handleAccount(request, (user, body) => deleteOwnRestaurant(getRegistry(), user, body));
}
