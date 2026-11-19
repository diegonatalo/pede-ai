import type { NextRequest } from "next/server";
import { handlePublic } from "@/lib/api/http";
import { success } from "@/lib/api/result";

export async function GET(request: NextRequest) {
  // Lê o restaurante da requisição: nada aqui é congelado no build, e o item esgotado some na hora.
  return handlePublic(request, async (store) => success(await store.getMenu()));
}
