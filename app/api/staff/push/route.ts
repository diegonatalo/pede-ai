import type { NextRequest } from "next/server";
import { handleStaff } from "@/lib/api/http";
import { getPushConfig, subscribePush, unsubscribePush } from "@/lib/api/push";
import { vapidConfig } from "@/lib/push-send";
import { getPushStore } from "@/lib/store";

export async function GET(request: NextRequest) {
  return handleStaff(request, (actor) => getPushConfig(actor, vapidConfig(process.env)?.publicKey ?? null));
}

export async function POST(request: NextRequest) {
  return handleStaff(request, async (actor, body, store) => {
    const restaurant = await store.getRestaurant();
    const enabled = vapidConfig(process.env) !== null;
    return subscribePush(getPushStore(), actor, restaurant.id, body, new Date().toISOString(), enabled);
  });
}

export async function DELETE(request: NextRequest) {
  return handleStaff(request, (actor, body) => unsubscribePush(getPushStore(), actor, body), { json: true });
}
