import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { createTeamMember, getTeam } from "@/lib/api/staff";
import { getStore } from "@/lib/store";

export async function GET(request: NextRequest) {
  return handleStaff(request, (actor) => getTeam(getStore(), actor));
}

export async function POST(request: NextRequest) {
  return handleStaff(request, (actor, body) => createTeamMember(getStore(), actor, body));
}
