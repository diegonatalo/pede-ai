import { createMemoryStore } from "@/lib/store/memory";
import type { Store } from "@/types/store";

// Guardado no globalThis para sobreviver ao recarregamento de módulos do `next dev`
// (e porque cada rota pode carregar a própria cópia deste módulo).
const holder = globalThis as typeof globalThis & { __pedeAiStore?: Store };

const methodsOf = (store: Store) => Object.keys(store).sort().join(",");

/**
 * Camada de dados do servidor. Por enquanto só existe o adaptador em memória;
 * o do Postgres entra quando houver `DATABASE_URL` (etapa do banco).
 *
 * No `next dev`, um store guardado antes de o adaptador ganhar métodos novos é trocado por um
 * novo (com os dados zerados). Mudanças só dentro de um método pedem reiniciar o `pnpm dev`.
 */
export const getStore = (): Store => {
  const fresh = holder.__pedeAiStore ? null : createMemoryStore();
  if (fresh) {
    holder.__pedeAiStore = fresh;
  } else if (process.env.NODE_ENV !== "production") {
    const current = createMemoryStore();
    if (methodsOf(current) !== methodsOf(holder.__pedeAiStore as Store)) holder.__pedeAiStore = current;
  }
  return holder.__pedeAiStore as Store;
};
