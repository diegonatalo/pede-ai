import type { NextRequest } from "next/server";
import { readSessionSecret } from "@/lib/api/config";
import { joinTable } from "@/lib/api/customer";
import { handleCustomer } from "@/lib/api/http";
import { clientIp, rateKey } from "@/lib/rate-limit";
import { getRateLimiter } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/join">) {
  const { id: tableId } = await ctx.params;
  // Quem erra o código muitas vezes, em qualquer mesa, espera um pouco (contra tentar mesa por mesa).
  const limiter = getRateLimiter();
  const key = rateKey("join", clientIp(request.headers), readSessionSecret(process.env));
  const guard = {
    isBlocked: () => limiter.isBlocked(key, Date.now()),
    recordFailure: () => limiter.recordFailure(key, Date.now()),
  };
  return handleCustomer(request, (identity, body, store) => joinTable(store, identity, tableId, body, Date.now(), guard));
}
