Requer [Node.js](https://nodejs.org) e [pnpm](https://pnpm.io).

```bash
git clone https://github.com/diegonatalo/pede-ai.git
cd pede-ai
pnpm install
pnpm dev        # http://localhost:3000
```

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Checa os tipos e gera o build de produção |
| `pnpm start` | Serve o build de produção |
| `pnpm lint` | Roda o ESLint |
| `pnpm test` | Roda os testes (Vitest) |
| `pnpm test:coverage` | Roda os testes com relatório de cobertura |
| `pnpm test:watch` | Reexecuta os testes ao salvar |
| `pnpm test:e2e` | Roda os testes de ponta a ponta (Playwright) |
| `pnpm db:generate` | Gera uma migração nova a partir de `lib/db/schema.ts` |
| `pnpm db:migrate` | Aplica as migrações no banco do `.env.local` (conexão direta) |

### 🔑 Variáveis de ambiente

Todas são opcionais no computador: sem banco, os dados ficam na memória do servidor.

| Variável | Descrição | Se não definir |
|---|---|---|
| `DATABASE_URL` | Postgres (Neon) com pooling, usado pelo app. Criada pela integração Neon da Vercel. | Dados na memória |
| `DATABASE_URL_UNPOOLED` | Conexão direta, usada pelas migrações (`pnpm db:migrate`). | Usa a `DATABASE_URL` |
| `PEDE_AI_STORE` | `postgres` para usar o banco no computador. Fora da Vercel, o padrão é a memória, para o `pnpm dev` e o E2E não gravarem no banco de produção. | Memória |
| `TEST_DATABASE_URL` | Banco de teste (um branch do Neon) para rodar os testes do store no Postgres. Cada teste apaga as tabelas: nunca use o de produção. | Testes do Postgres pulados |
| `SESSION_SECRET` | Chave que assina os cookies do cliente e da equipe e, sem `BETTER_AUTH_SECRET`, também as sessões das contas. **Obrigatória na Vercel**: lá há várias instâncias, e cada uma geraria a própria chave. | Gera uma chave aleatória a cada início do servidor |
| `BETTER_AUTH_SECRET` | Chave só do login das contas (Better Auth), se quiser separada da `SESSION_SECRET`. | Usa a `SESSION_SECRET` |
| `BETTER_AUTH_URL` | Endereço do site para o login, se for diferente do `NEXT_PUBLIC_SITE_URL`. | Na Vercel, o endereço do site; no computador, `localhost` em qualquer porta |
| `STAFF_PIN_KITCHEN`, `STAFF_PIN_WAITER`, `STAFF_PIN_MANAGER` | PIN de cada papel da equipe. | PINs da demo: `1111`, `2222` e `3333` |
| `NEXT_PUBLIC_SITE_URL` | URL pública do site, usada nas tags Open Graph, no `robots.txt` e no `sitemap.xml`. Sem barra no final. | Usa `https://dn-pede-ai.vercel.app` |
