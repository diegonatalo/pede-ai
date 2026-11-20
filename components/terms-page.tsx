import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { HomeBrandLink, linkClass } from "@/components/legal-links";
import { PRIVACY_EMAIL, SITE_NAME } from "@/lib/site";
import { TERMS_VERSION } from "@/lib/terms";

/** Termos de uso do Pede Aí. A data é a própria versão: mudou o texto, mude `TERMS_VERSION`. */
export const TermsPage = () => (
  <LegalPage
    header={<HomeBrandLink />}
    title="Termos de uso"
    summary={`As regras para usar o ${SITE_NAME}. Quem cria uma conta de restaurante aceita estes termos.`}
    updatedAt={TERMS_VERSION}
    sections={[
      {
        id: "o-que-e",
        title: "O que é o Pede Aí",
        content: (
          <p>
            O {SITE_NAME} é um sistema para restaurantes receberem pedidos pelo QR code da mesa, com comanda por
            pessoa, fila da cozinha e do bar, avisos ao garçom e conta dividida. Ele é mantido por Diego Natalo e,
            por enquanto, é <strong>gratuito</strong>.
          </p>
        ),
      },
      {
        id: "papeis",
        title: "Quem responde pelo quê",
        content: (
          <>
            <p>
              <strong>O restaurante</strong> decide como usa o {SITE_NAME} e os dados dos clientes dele. Pela LGPD, ele
              é o <strong>controlador</strong>: responde por informar os clientes, atender os pedidos deles sobre os
              próprios dados e cuidar de quem da equipe tem acesso (PINs).
            </p>
            <p>
              <strong>O {SITE_NAME}</strong> guarda e processa esses dados só para o sistema funcionar, conforme as
              instruções do restaurante. Pela LGPD, é o <strong>operador</strong>. O que é guardado e por quanto tempo
              está na{" "}
              <Link href="/privacidade" className={linkClass}>
                política de privacidade
              </Link>
              .
            </p>
          </>
        ),
      },
      {
        id: "conta",
        title: "Conta e equipe",
        content: (
          <>
            <p>
              A conta do dono é pessoal. Guarde a senha e os PINs da equipe; quem tiver um PIN entra nas telas daquele
              papel. Desative na tela de equipe quem sair do restaurante.
            </p>
            <p>
              Você pode excluir um restaurante ou a conta inteira a qualquer momento, em{" "}
              <Link href="/conta" className={linkClass}>
                Sua conta
              </Link>
              . A exclusão apaga tudo de verdade e não pode ser desfeita.
            </p>
          </>
        ),
      },
      {
        id: "uso",
        title: "Uso aceitável",
        content: (
          <p>
            Não use o {SITE_NAME} para nada ilegal, para cadastrar dados que você não tem direito de usar (como CPF ou
            dados de saúde de clientes nos nomes e observações) nem para atrapalhar o serviço ou o acesso de outras
            pessoas. Contas usadas assim podem ser suspensas.
          </p>
        ),
      },
      {
        id: "disponibilidade",
        title: "Disponibilidade",
        content: (
          <p>
            O {SITE_NAME} é oferecido &quot;como está&quot;, sem garantia de que vai funcionar sempre ou sem erros. Ele
            não substitui o sistema de caixa nem a nota fiscal do restaurante. O serviço pode mudar, ganhar planos
            pagos (com aviso antes) ou sair do ar.
          </p>
        ),
      },
      {
        id: "mudancas",
        title: "Mudanças nestes termos",
        content: (
          <p>
            Quando estes termos mudarem, a data no topo muda junto, e o dono precisa aceitar a versão nova no próximo
            acesso à conta.
          </p>
        ),
      },
      {
        id: "contato",
        title: "Contato",
        content: (
          <p>
            <a href={`mailto:${PRIVACY_EMAIL}`} className={linkClass}>
              {PRIVACY_EMAIL}
            </a>
          </p>
        ),
      },
    ]}
  />
);
