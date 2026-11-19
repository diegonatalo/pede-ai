import { createMemoryStore } from "@/lib/store/memory";
import type { Store } from "@/types/store";

// Guardado no globalThis para sobreviver ao recarregamento de módulos do `next dev`.
const holder = globalThis as typeof globalThis & { __pedeAiStore?: Store };

/**
 * Camada de dados do servidor. Por enquanto só existe o adaptador em memória;
 * o do Postgres entra quando houver `DATABASE_URL` (etapa do banco).
 */
export const getStore = (): Store => {
  holder.__pedeAiStore ??= createMemoryStore();
  return holder.__pedeAiStore;
};
