### 🧪 Testes

```bash
pnpm test
```

Usa [Vitest](https://vitest.dev) e Testing Library. Cobrem a formatação e a leitura de valores em reais (sempre em centavos inteiros), a consistência dos dados de demonstração (ids, categorias, preços, mapa sem sobreposição) as regras de estado (quem pode levar um item, uma comanda ou um chamado para o próximo estado, o que pode ser desfeito e quando a mesa pode fechar) a conta de cada comanda (itens divididos sem perder nem criar centavos, cancelados fora, taxa de serviço e couvert por pessoa, uma mesa com dois casais e uma amiga) os serviços da API (o cliente só mexe na própria comanda, PIN e papel da equipe, cookies assinados), o carrinho, o polling (pausa com a aba escondida), as filas do garçom (confirmar, retirar, chamados, situação das mesas) e da cozinha (colunas por estado, filtro por estação), as telas do cliente (código da mesa, comanda, cardápio, carrinho, pedidos) , do garçom (login por PIN, agora, mesas) e da cozinha (fila, esgotar item), a camada de dados em memória (abrir e fechar a mesa, código com bloqueio depois de 5 erros, confirmação do primeiro pedido, item esgotado, divisão, chamados e o registro de eventos) e a tela de erro. As telas entram com testes a cada etapa.

Para reexecutar ao salvar: `pnpm test:watch`.

Os testes de ponta a ponta (Playwright, em `e2e/`) abrem o app no Chromium contra o build de produção e conferem que as páginas abrem sem erros, que a 404 leva de volta ao início a cozinha e o bar preparando pela fila e esgotando um item enquanto o cliente acompanha, o garçom abrindo a mesa, confirmando, entregando, recebendo e fechando enquanto o cliente acompanha pelo celular, o pedido pela tela com dois celulares na mesma mesa (cada um vê só os próprios pedidos, o estado atualiza sozinho e nada se perde ao recarregar) e o fluxo completo pela API, com aparelhos separados: o garçom abre a mesa, o cliente entra com o código e pede, a cozinha prepara, o garçom entrega e fecha a mesa.

```bash
pnpm exec playwright install chromium   # só na primeira vez
pnpm test:e2e                           # gera o build e testa contra ele
```
