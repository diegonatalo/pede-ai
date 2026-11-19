### 🌐 Deploy

Publicado na [Vercel](https://vercel.com), que faz deploy só da branch `main` (`vercel.json`). Para trocar de domínio, defina `NEXT_PUBLIC_SITE_URL` no build.

A demonstração guarda os dados na memória do servidor: funciona com um processo só (`pnpm start`) e os dados somem quando ele reinicia. Na Vercel, cada requisição pode cair numa instância diferente, então a versão publicada vai depender do banco (Postgres), que é uma etapa própria.
