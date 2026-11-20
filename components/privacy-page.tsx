import Link from "next/link";
import { AmbientGlow, BrandMark } from "@/components/ui/brand";
import { CARD } from "@/components/ui/styles";
import { RETENTION_DAYS } from "@/lib/privacy";

/** Data da última mudança desta política (mostrada no topo). */
const UPDATED_AT = "20 de novembro de 2026";

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section aria-labelledby={id} className={`${CARD} flex flex-col gap-3 p-6`}>
    <h2 id={id} className="text-xl font-bold">
      {title}
    </h2>
    <div className="flex flex-col gap-3 text-muted [&_strong]:text-foreground">{children}</div>
  </section>
);

/** Política de privacidade em linguagem simples (LGPD). */
export const PrivacyPage = () => (
  <main id="conteudo" className="relative isolate mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
    <AmbientGlow />
    <Link
      href="/"
      className="self-start rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      aria-label="Pede Aí, voltar ao início"
    >
      <BrandMark />
    </Link>
    <header className="flex flex-col gap-2">
      <h1 className="text-4xl font-bold tracking-tight">Privacidade</h1>
      <p className="text-lg text-muted">
        O que o Pede Aí guarda, para quê, por quanto tempo e como apagar. Atualizada em {UPDATED_AT}.
      </p>
    </header>

    <Section id="quem" title="Quem é quem">
      <p>
        O Pede Aí é o sistema que o restaurante usa para receber pedidos pela mesa. <strong>Cada restaurante</strong>{" "}
        decide como usar os dados das mesas dele; o Pede Aí guarda esses dados para o restaurante e não os usa para mais
        nada.
      </p>
    </Section>

    <Section id="cliente" title="Se você pediu pela mesa">
      <p>
        Guardamos <strong>o nome ou apelido</strong> que você digitou na comanda, quantas pessoas estão nela, o que foi
        pedido (com as observações, como &quot;sem cebola&quot;), os recados ao garçom e os valores da conta. Isso serve
        para levar o pedido certo e fazer a conta de cada um.
      </p>
      <p>
        Não pedimos CPF, telefone nem e-mail. Seu celular guarda um cookie que mantém você na mesa por até 12 horas.
      </p>
      <p>
        <strong>{RETENTION_DAYS} dias depois que a mesa fecha</strong>, o nome da comanda vira &quot;Cliente&quot; e as
        observações e recados são apagados. Ficam só os valores e horários, sem identificar ninguém, para os números do
        restaurante.
      </p>
    </Section>

    <Section id="restaurante" title="Se você é dono ou trabalha no restaurante">
      <p>
        A conta do dono tem <strong>nome, e-mail e senha</strong>. A senha é guardada só embaralhada (hash), e ninguém
        consegue lê-la. Cada pessoa da equipe tem nome, papel e um PIN, que também é guardado só como uma chave derivada.
        Cada ação da equipe fica registrada com quem fez, para o restaurante acompanhar o serviço.
      </p>
      <p>
        O dono pode <strong>excluir um restaurante ou a conta inteira</strong> a qualquer momento, em{" "}
        <Link href="/conta" className="font-semibold text-accent underline-offset-2 hover:underline">
          Sua conta
        </Link>
        . Tudo é apagado de verdade: cardápio, mesas, equipe, pedidos e números.
      </p>
    </Section>

    <Section id="cookies" title="Cookies">
      <p>
        Usamos <strong>só os cookies necessários</strong> para o sistema funcionar: o da mesa (cliente), o da equipe
        (PIN) e o da conta do dono. Não usamos cookies de propaganda, rastreamento ou estatística de visitas.
      </p>
    </Section>

    <Section id="onde" title="Onde os dados ficam">
      <p>
        O site roda na <strong>Vercel</strong>, e os dados ficam num banco Postgres da <strong>Neon</strong>, em São
        Paulo. A conexão é sempre criptografada (HTTPS).
      </p>
    </Section>

    <Section id="direitos" title="Seus direitos">
      <p>
        Pela LGPD, você pode pedir para ver, corrigir ou apagar seus dados. Se você pediu pela mesa, fale com o
        restaurante: ele tem acesso às comandas. Se você é dono, faça isso direto em{" "}
        <Link href="/conta" className="font-semibold text-accent underline-offset-2 hover:underline">
          Sua conta
        </Link>
        .
      </p>
    </Section>
  </main>
);
