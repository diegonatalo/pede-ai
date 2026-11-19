import { connection } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  // Sem isso o cardápio seria congelado no build, e o item esgotado não sumiria.
  await connection();
  return Response.json(await getStore().getMenu(), { headers: { "cache-control": "no-store" } });
}
