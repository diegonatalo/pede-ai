import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { assertDevDatabase } from "@/lib/dev-database";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Conexão (HTTP) com o Neon para uma URL. Os testes do store no Postgres usam a do banco de teste. */
export const createDb = (url: string): Db => drizzle(url, { schema });

// Guardada no globalThis para sobreviver ao recarregamento de módulos do `next dev`
// (e porque cada rota pode carregar a própria cópia deste módulo).
const holder = globalThis as typeof globalThis & { __pedeAiDb?: Db };

/**
 * A conexão do app, repartida entre o login, o cadastro e os repositórios de cada
 * restaurante. Criada só no primeiro uso: sem `DATABASE_URL`, o app usa a memória.
 */
export const getDb = (): Db => {
  // só no `next dev`: a trava não roda no site publicado
  if (process.env.NODE_ENV === "development") assertDevDatabase(process.env);
  holder.__pedeAiDb ??= createDb(process.env.DATABASE_URL as string);
  return holder.__pedeAiDb;
};
