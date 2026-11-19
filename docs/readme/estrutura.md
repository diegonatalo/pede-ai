```text
app/              Rotas (página inicial, 404, erros, robots, sitemap, imagem OG)
app/api/          Route Handlers finos sobre os serviços de lib/api
components/       Corpo das telas (customer/ para o celular do cliente, waiter/, kitchen/ e staff/ para a equipe, ui/ para estilos comuns)
docs/             Textos e imagens do README (readme-kit)
e2e/              Testes de ponta a ponta (Playwright)
hooks/            Estado e efeitos de React (polling do feed, visão do cliente e da equipe, tela acesa, aviso sonoro)
lib/              Lógica pura (dinheiro, estados, conta), serviços da API (lib/api), camada de dados (lib/store) e dados de demonstração
types/            Tipos do domínio (mesa, comanda, pedido, item, chamado)
```
