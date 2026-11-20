import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { HomeBrandLink, linkClass } from "@/components/legal-links";
import { RETENTION_DAYS } from "@/lib/privacy";
import { PRIVACY_EMAIL } from "@/lib/site";

/** Data da última mudança desta política (`AAAA-MM-DD`). */
const UPDATED_AT = "2026-11-20";

const AccountLink = () => (
  <Link href="/conta" className={linkClass}>
    Sua conta
  </Link>
);

/** Política de privacidade em linguagem simples (LGPD). */
export const PrivacyPage = () => (
  <LegalPage
    header={<HomeBrandLink />}
    title="Privacidade"
    summary="O que o Pede Aí guarda, para quê, por quanto tempo e como apagar."
    updatedAt={UPDATED_AT}
    sections={[
      {
        id: "quem",
        title: "Quem é quem",
        content: (
          <p>
            O Pede Aí é o sistema que o restaurante usa para receber pedidos pela mesa. <strong>Cada restaurante</strong>{" "}
            decide como usar os dados das mesas dele (é o controlador, nos termos da LGPD); o Pede Aí guarda esses dados
            para o restaurante e não os usa para mais nada (é o operador). Veja também os{" "}
            <Link href="/termos" className={linkClass}>
              termos de uso
            </Link>
            .
          </p>
        ),
      },
      {
        id: "cliente",
        title: "Se você pediu pela mesa",
        content: (
          <>
            <p>
              Guardamos <strong>o nome ou apelido</strong> que você digitou na comanda, quantas pessoas estão nela, o que
              foi pedido (com as observações, como &quot;sem cebola&quot;), os recados ao garçom e os valores da conta.
              Isso serve para levar o pedido certo e fazer a conta de cada um.
            </p>
            <p>
              Não pedimos CPF, telefone nem e-mail. Seu celular guarda um cookie que mantém você na mesa por até 12 horas.
            </p>
            <p>
              <strong>{RETENTION_DAYS} dias depois que a mesa fecha</strong>, o nome da comanda vira &quot;Cliente&quot; e
              as observações e recados são apagados. Ficam só os valores e horários, sem identificar ninguém, para os
              números do restaurante.
            </p>
          </>
        ),
      },
      {
        id: "restaurante",
        title: "Se você é dono ou trabalha no restaurante",
        content: (
          <>
            <p>
              A conta do dono tem <strong>nome, e-mail e senha</strong>, além da versão dos termos de uso que ele aceitou
              e quando. A senha é guardada só embaralhada (hash), e ninguém consegue lê-la. Cada pessoa da equipe tem
              nome, papel e um PIN, que também é guardado só como uma chave derivada. Cada ação da equipe fica
              registrada com quem fez, para o restaurante acompanhar o serviço.
            </p>
            <p>
              Se alguém da equipe ativa os <strong>avisos no celular</strong>, guardamos o endereço que o navegador
              fornece para entregar as notificações. Esse endereço é do serviço de notificações do próprio navegador
              (do Google, da Apple ou da Mozilla, conforme o aparelho), que recebe só o aviso, sem dados dos clientes.
              Desativar os avisos apaga esse endereço, e ele também some quando a pessoa sai da equipe ou o restaurante é excluído.
            </p>
            <p>
              O dono pode <strong>excluir um restaurante ou a conta inteira</strong> a qualquer momento, em{" "}
              <AccountLink />. Tudo é apagado de verdade: cardápio, mesas, equipe, pedidos e números.
            </p>
          </>
        ),
      },
      {
        id: "seguranca",
        title: "Proteção contra abusos",
        content: (
          <p>
            Para barrar quem tenta adivinhar códigos de mesa ou PINs, contamos as tentativas erradas de cada endereço
            de internet (IP). O IP não é guardado como está: vira uma chave embaralhada, e as contagens são apagadas
            em até um dia.
          </p>
        ),
      },
      {
        id: "cookies",
        title: "Cookies",
        content: (
          <p>
            Usamos <strong>só os cookies necessários</strong> para o sistema funcionar: o da mesa (cliente), o da equipe
            (PIN) e o da conta do dono. Não usamos cookies de propaganda, rastreamento ou estatística de visitas.
          </p>
        ),
      },
      {
        id: "onde",
        title: "Onde os dados ficam",
        content: (
          <p>
            O site roda na <strong>Vercel</strong>, que registra dados técnicos de acesso (como IP e navegador) para
            entregar o site, e os dados ficam num banco Postgres da <strong>Neon</strong>, em São Paulo. A conexão é
            sempre criptografada (HTTPS).
          </p>
        ),
      },
      {
        id: "direitos",
        title: "Seus direitos",
        content: (
          <>
            <p>
              Pela LGPD, você pode pedir para ver, corrigir ou apagar seus dados. Se você pediu pela mesa, fale com o
              restaurante: ele tem acesso às comandas. Se você é dono, faça isso direto em <AccountLink />.
            </p>
            <p>
              Dúvidas sobre esta página:{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className={linkClass}>
                {PRIVACY_EMAIL}
              </a>
              .
            </p>
          </>
        ),
      },
    ]}
  />
);
