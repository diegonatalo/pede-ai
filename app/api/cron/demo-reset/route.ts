import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { getRegistry } from "@/lib/store";

/** Limpeza diária da demonstração (agendada em `.github/workflows/demo-reset.yml`). Os outros restaurantes ficam. */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  await getRegistry().resetDemo();
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
