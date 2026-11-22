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
| `pnpm db:migrate` | Aplica as migrações no banco do `.env.local` (a branch `dev` do Neon) |

### 🔑 Variáveis de ambiente

Todas são opcionais no computador: sem banco, os dados ficam na memória do servidor. Copie o `.env.example` para `.env.local`; a `DATABASE_URL` dele é a de uma branch `dev` do Neon, nunca a de produção.

| Variável | Descrição | Se não definir |
|---|---|---|
| `DATABASE_URL` | Postgres (Neon) com pooling, usado pelo app. Criada pela integração Neon da Vercel. No computador, o nome do banco precisa terminar em `_dev`. | Dados na memória |
| `DATABASE_URL_UNPOOLED` | Conexão direta, usada pelas migrações (`pnpm db:migrate`). | Usa a `DATABASE_URL` |
| `PEDE_AI_STORE` | `postgres` para o `pnpm dev` usar o banco do `.env.local`. Fora da Vercel, o padrão é a memória (o E2E também roda nela). | Memória |
| `TEST_DATABASE_URL` | Banco de teste (um branch do Neon) para rodar os testes do store no Postgres. Cada teste apaga as tabelas: use um nome como `pede_ai_dev_test`; fora de `_dev` e `_dev_test`, é recusado. | Testes do Postgres pulados |
| `SESSION_SECRET` | Chave que assina os cookies do cliente e da equipe e, sem `BETTER_AUTH_SECRET`, também as sessões das contas. Também embaralha o IP nas contagens de tentativas. **Obrigatória na Vercel**: lá há várias instâncias, e cada uma geraria a própria chave (as sessões cairiam e o limite de login contaria separado). | Gera uma chave aleatória a cada início do servidor |
| `CRON_SECRET` | Senha da rotina diária de privacidade (`/api/cron/privacy`). Vai na Vercel e, com o mesmo valor, nos segredos do repositório no GitHub: o workflow `privacy-cleanup.yml` chama a rota todo dia às 6h de Brasília. | A limpeza não roda |
| `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` | Chaves dos avisos no celular da equipe (Web Push). Gere uma vez com `pnpm exec web-push generate-vapid-keys` e ponha na Vercel. A privada fica só no servidor. | A tela do garçom não oferece avisos |
| `VAPID_SUBJECT` | Contato do dono do app para os serviços de push (`mailto:...` ou um endereço https). | O endereço do site |
| `BETTER_AUTH_SECRET` | Chave só do login das contas (Better Auth), se quiser separada da `SESSION_SECRET`. | Usa a `SESSION_SECRET` |
| `BETTER_AUTH_URL` | Endereço do site para o login, se for diferente do `NEXT_PUBLIC_SITE_URL`. | Na Vercel, o endereço do site; no computador, `localhost` em qualquer porta |
| `NEXT_PUBLIC_SITE_URL` | URL pública do site, usada nas tags Open Graph, no `robots.txt` e no `sitemap.xml`. Sem barra no final. | Usa `https://dn-pede-ai.vercel.app` |
