import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/server";

// Todas as rotas do login (criar conta, entrar, sair, sessão) ficam com o Better Auth.
const handler = (request: Request) => getAuth().handler(request);

export const { GET, POST } = toNextJsHandler(handler);
