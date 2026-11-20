import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { RETENTION_DAYS, retentionCutoff } from "@/lib/privacy";
import { getRateLimiter, getRegistry } from "@/lib/store";

/**
 * Rotina diária de privacidade (agendada em `.github/workflows/privacy-cleanup.yml`): nas mesas
 * fechadas há mais de `RETENTION_DAYS` dias, apaga nomes das comandas, observações e recados.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const cutoff = retentionCutoff(new Date());
  const anonymizedTabs = await getRegistry().anonymizeClosedBefore(cutoff);
  // Contagens de tentativas só valem por minutos; as de mais de um dia já não servem para nada.
  const prunedRateLimits = await getRateLimiter().prune(Date.now() - 24 * 60 * 60_000);
  return NextResponse.json(
    { ok: true, retentionDays: RETENTION_DAYS, cutoff, anonymizedTabs, prunedRateLimits },
    { headers: { "cache-control": "no-store" } },
  );
}
