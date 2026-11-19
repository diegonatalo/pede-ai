import type { NextRequest } from "next/server";
import { enterAsOwner } from "@/lib/api/account";
import { handleAccount } from "@/lib/api/http";
import { getRegistry, getStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  return handleAccount(request, (user, body, staff) =>
    enterAsOwner(getRegistry(), getStore, user, staff, body, Date.now()),
  );
}
