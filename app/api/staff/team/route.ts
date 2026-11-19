import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { createTeamMember, getTeam } from "@/lib/api/staff";

export async function GET(request: NextRequest) {
  return handleStaff(request, (actor, _body, store) => getTeam(store, actor));
}

export async function POST(request: NextRequest) {
  return handleStaff(request, (actor, body, store) => createTeamMember(store, actor, body));
}
