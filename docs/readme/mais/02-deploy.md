### 🌐 Deploy

Publicado na [Vercel](https://vercel.com), que faz deploy só da branch `main` (`vercel.json`). Para trocar de domínio, defina `NEXT_PUBLIC_SITE_URL` no build.

Na Vercel, os dados ficam no Postgres do Neon (integração da Vercel, que cria a `DATABASE_URL`). No computador, sem `PEDE_AI_STORE=postgres`, ficam na memória do servidor e somem quando ele reinicia.

Mudou o schema (`lib/db/schema.ts`)? Rode `pnpm db:generate`, revise a migração em `lib/db/migrations/` e rode `pnpm db:migrate` **antes** de mesclar o PR, para o deploy já encontrar o banco atualizado. Os dados de demonstração (cardápio, mesas, mapa) são gravados sozinhos no primeiro acesso.
