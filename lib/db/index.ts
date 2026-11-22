import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { assertDevDatabase } from "@/lib/dev-database";
import { hideQueryValues, toSafeError } from "./safe-errors";
import * as schema from "./schema";

// o erro de uma consulta nunca leva os valores dela para o log
hideQueryValues();

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Conexão (HTTP) com o Neon para uma URL. Os testes do store no Postgres usam a do banco de teste. */
export const createDb = (url: string): Db => {
  const db = drizzle(url, { schema });
  // o `batch` não passa pelo caminho das outras consultas
  const batch = db.batch.bind(db);
  db.batch = ((queries: Parameters<Db["batch"]>[0]) =>
    batch(queries).catch((error: unknown) => {
      throw toSafeError(error);
    })) as unknown as Db["batch"];
  return db;
};

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
