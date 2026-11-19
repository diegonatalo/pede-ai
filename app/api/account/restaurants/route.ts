import type { NextRequest } from "next/server";
import { createOwnRestaurant, listOwnRestaurants } from "@/lib/api/account";
import { handleAccount } from "@/lib/api/http";
import { generateStaffPin } from "@/lib/staff-pin";
import { getRegistry } from "@/lib/store";

export async function GET(request: NextRequest) {
  return handleAccount(request, (user) => listOwnRestaurants(getRegistry(), user));
}

export async function POST(request: NextRequest) {
  return handleAccount(request, (user, body) =>
    createOwnRestaurant(
      {
        registry: getRegistry(),
        now: () => new Date().toISOString(),
        newId: () => crypto.randomUUID(),
        newPin: () => generateStaffPin(),
      },
      user,
      body,
    ),
  );
}
