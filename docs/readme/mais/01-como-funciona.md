### 🧠 Como funciona

| Conceito | Regra |
|---|---|
| **Sessão da mesa** | O garçom abre a mesa quando o grupo senta. Só dá para pedir com a mesa aberta e o código de 4 dígitos. |
| **Comanda** | Cada pessoa (ou aparelho) tem a sua. O primeiro pedido de cada comanda passa pela confirmação do garçom. |
| **Item** | Enviado → em preparo → pronto → retirado → entregue. Cada item vai para a cozinha ou para o bar. |
| **Conta do dono** | O dono do restaurante cria a conta com e-mail e senha (Better Auth; senha guardada só como hash, sessões no banco). Sem serviço externo: por enquanto não há confirmação de e-mail nem redefinição por link. |
| **Acesso** | O celular do cliente e o da equipe guardam um cookie assinado. A equipe entra com o PIN do papel (cozinha, garçom ou gerente). |
| **Duas pessoas ao mesmo tempo** | Cada mesa tem uma versão. Uma gravação só vale se ninguém gravou a mesma mesa desde a leitura; se gravou, o app relê e tenta de novo. |
| **Conta** | Calculada por comanda, em centavos inteiros: itens próprios, partes de itens divididos, taxa de serviço e couvert. |
