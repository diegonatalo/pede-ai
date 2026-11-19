### 🧠 Como funciona

| Conceito | Regra |
|---|---|
| **Sessão da mesa** | O garçom abre a mesa quando o grupo senta. Só dá para pedir com a mesa aberta e o código de 4 dígitos. |
| **Comanda** | Cada pessoa (ou aparelho) tem a sua. O primeiro pedido de cada comanda passa pela confirmação do garçom. |
| **Item** | Enviado → em preparo → pronto → retirado → entregue. Cada item vai para a cozinha ou para o bar. |
| **Conta do dono** | O dono do restaurante cria a conta com e-mail e senha (Better Auth; senha guardada só como hash, sessões no banco). Sem serviço externo: por enquanto não há confirmação de e-mail nem redefinição por link. |
| **Equipe** | Cada pessoa tem o próprio PIN de 6 dígitos, criado pelo gerente na seção Equipe e mostrado uma vez só. O banco guarda só uma chave derivada do PIN (HMAC com a chave do app). Cada ação registra quem fez; quem é desativado perde o acesso na hora. O gerente pode usar qualquer tela; as outras pessoas, só a do próprio papel. A demonstração tem uma pessoa por papel com os PINs públicos 1111, 2222 e 3333. |
| **Acesso** | O celular do cliente e o da equipe guardam um cookie assinado. A equipe entra com o PIN pessoal, e o cookie guarda quem entrou em cada tela. |
| **Vários restaurantes** | Cada restaurante tem endereço próprio (slug) e o próprio salão, cardápio, equipe, mesas e eventos. A camada de dados é criada para um restaurante e toda consulta filtra por ele: nada de um aparece ou muda no outro, nem pelo id. As telas ficam no endereço do restaurante (`/r/<slug>/mesa/<id>`, `/r/<slug>/garcom`, `/r/<slug>/cozinha`, `/r/<slug>/gerente`), o QR de cada mesa aponta para lá e o login da equipe vale só no restaurante em que foi feito. Os endereços antigos (`/garcom`, `/mesa/<id>`…) abrem a demonstração. |
| **Duas pessoas ao mesmo tempo** | Cada mesa tem uma versão. Uma gravação só vale se ninguém gravou a mesma mesa desde a leitura; se gravou, o app relê e tenta de novo. |
| **Conta** | Calculada por comanda, em centavos inteiros: itens próprios, partes de itens divididos, taxa de serviço e couvert. |
