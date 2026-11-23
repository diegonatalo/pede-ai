import type { NextRequest } from "next/server";
import { readSessionSecret } from "@/lib/api/config";
import { handleStaffSession } from "@/lib/api/http";
import { staffLogin } from "@/lib/api/staff";
import { clientIp, rateKey } from "@/lib/rate-limit";
import { getRateLimiter } from "@/lib/store";

export async function POST(request: NextRequest) {
  // Quem erra o PIN muitas vezes, em qualquer restaurante, espera um pouco (como o código da mesa).
  const limiter = getRateLimiter();
  const key = rateKey("staff-pin", clientIp(request.headers), readSessionSecret(process.env));
  const guard = {
    isBlocked: () => limiter.isBlocked(key, Date.now()),
    recordFailure: () => limiter.recordFailure(key, Date.now()),
  };
  return handleStaffSession(request, (identity, body, restaurant) =>
    staffLogin(restaurant.store, identity, body, Date.now(), restaurant.id, guard),
  );
}
