import { createStore } from "@/lib/store/engine";
import { createMemoryStore } from "@/lib/store/memory";
import { createPostgresRepository } from "@/lib/store/postgres";
import type { Store } from "@/types/store";

// Guardado no globalThis para sobreviver ao recarregamento de módulos do `next dev`
// (e porque cada rota pode carregar a própria cópia deste módulo).
const holder = globalThis as typeof globalThis & { __pedeAiStore?: Store; __pedeAiPostgres?: Store };

const methodsOf = (store: Store) => Object.keys(store).sort().join(",");

type Env = Record<string, string | undefined>;

/**
 * Qual banco usar. Postgres só na Vercel (`VERCEL`) ou quando pedido (`PEDE_AI_STORE=postgres`):
 * o `.env.local` tem a `DATABASE_URL` de produção, e o `pnpm dev` e o E2E não devem gravar lá.
 */
export const storeKind = (env: Env): "postgres" | "memory" =>
  env.DATABASE_URL && (env.VERCEL || env.PEDE_AI_STORE === "postgres") ? "postgres" : "memory";

/**
 * Camada de dados do servidor: Postgres (Neon) em produção, memória no resto.
 *
 * No `next dev`, um store em memória guardado antes de o motor ganhar métodos novos é trocado
 * por um novo (com os dados zerados). Mudanças só dentro de um método pedem reiniciar o `pnpm dev`.
 */
export const getStore = (): Store => {
  if (storeKind(process.env) === "postgres") {
    holder.__pedeAiPostgres ??= createStore(createPostgresRepository(process.env.DATABASE_URL as string));
    // Repositório e motor usam a mesma chave de PIN por padrão (SESSION_SECRET).
    return holder.__pedeAiPostgres;
  }
  const fresh = holder.__pedeAiStore ? null : createMemoryStore();
  if (fresh) {
    holder.__pedeAiStore = fresh;
  } else if (process.env.NODE_ENV !== "production") {
    const current = createMemoryStore();
    if (methodsOf(current) !== methodsOf(holder.__pedeAiStore as Store)) holder.__pedeAiStore = current;
  }
  return holder.__pedeAiStore as Store;
};
