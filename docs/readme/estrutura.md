```text
app/              Rotas (página inicial, 404, erros, robots, sitemap, imagem OG)
app/api/          Route Handlers finos sobre os serviços de lib/api
components/       Corpo das telas (account/ para a conta do dono, customer/ para o celular do cliente, waiter/, kitchen/, manager/ e staff/ para a equipe, ui/ para estilos comuns)
docs/             Textos e imagens do README (readme-kit)
drizzle/          Migrações do banco, geradas por pnpm db:generate e aplicadas no deploy
e2e/              Testes de ponta a ponta (Playwright)
hooks/            Estado e efeitos de React (polling do feed, visão do cliente e da equipe, tela acesa, aviso sonoro)
lib/              Lógica pura (dinheiro, estados, conta), login das contas (lib/auth, Better Auth), serviços da API (lib/api), camada de dados (lib/store: regras + memória ou Postgres), banco (lib/db: schema e conexão, só no servidor) e o restaurante de exemplo (modelo dos restaurantes novos e base dos testes)
types/            Tipos do domínio (mesa, comanda, pedido, item, chamado)
proxy.ts          Checagem otimista do cookie da conta: sem ele, /conta vai para /entrar
```
