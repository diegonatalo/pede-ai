import type { NextRequest } from "next/server";
import { readStaffPins } from "@/lib/api/config";
import { handleStaffSession } from "@/lib/api/http";
import { staffLogin } from "@/lib/api/staff";

export async function POST(request: NextRequest) {
  return handleStaffSession(request, (identity, body) =>
    staffLogin(identity, body, readStaffPins(process.env), Date.now()),
  );
}
