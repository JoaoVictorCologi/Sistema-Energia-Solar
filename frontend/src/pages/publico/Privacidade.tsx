import type { ReactNode } from 'react';
import { empresa } from '../../dados/empresa.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';

// Atualizar a data só quando o texto mudar de fato. A tarefa 12 (pedido de proposta) e o Plano 6 (contato pela API) mudam as seções 2 a 4.
const ATUALIZADA_EM = '30 de outubro de 2026';

const classeDoLinkExterno = 'break-all underline underline-offset-4';

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-xl font-semibold text-foreground">{titulo}</h2>
      <div className="mt-3 flex flex-col gap-3 text-muted-foreground">{children}</div>
    </section>
  );
}

export function Privacidade() {
  useTituloDaPagina('Política de Privacidade — Don Energy');

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-heading text-3xl font-medium tracking-tight text-brand-blue sm:text-4xl">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: {ATUALIZADA_EM}</p>

      <div className="mt-10 flex flex-col gap-8">
        <Secao titulo="1. Quem somos">
          <p>A Don Energy (“nós”) é uma empresa de energia solar sediada em Mococa-SP, responsável pelo tratamento dos dados pessoais coletados por este site.</p>
        </Secao>

        <Secao titulo="2. Quais dados você informa">
          <p>
            Coletamos apenas os dados que você mesmo informa no formulário de contato: nome, telefone, cidade, perfil solar e, se quiser,
            o consumo mensal de energia ou o valor da conta de luz.
          </p>
          <p>Não usamos cookies de rastreamento, pixels de anúncio nem ferramentas de análise de comportamento.</p>
        </Secao>

        <Secao titulo="3. Como usamos seus dados">
          <p>Usamos essas informações só para elaborar uma proposta de energia solar e entrar em contato com você.</p>
        </Secao>

        <Secao titulo="4. Como seus dados são transmitidos">
          <p>
            O formulário de contato não grava seus dados em banco de dados. Ao preencher e enviar, seu navegador monta uma mensagem com
            os dados informados e abre o WhatsApp, e o envio é decidido por você. Essa conversa segue a{' '}
            <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className={classeDoLinkExterno}>política de privacidade do WhatsApp</a>.
          </p>
        </Secao>

        <Secao titulo="5. Mapa, fontes e serviços do Google">
          <p>
            O mapa do Google na página de contato só é carregado quando você escolhe “Carregar mapa”, e o link “Como chegar” abre um serviço
            do Google. As fontes do site também são carregadas do Google Fonts. Nesses casos, o navegador se conecta ao Google, que recebe as
            informações técnicas da conexão, conforme a{' '}
            <a href="https://policies.google.com/privacy?hl=pt-BR" target="_blank" rel="noopener noreferrer" className={classeDoLinkExterno}>política de privacidade do Google</a>.
            Os dados do formulário não são enviados ao Google.
          </p>
        </Secao>

        <Secao titulo="6. Cookie da área restrita">
          <p>A área do administrador usa um único cookie de sessão, necessário para manter o login. Ele não é usado para rastrear visitantes e é apagado ao sair ou depois de 8 horas.</p>
        </Secao>

        <Secao titulo="7. Compartilhamento com terceiros">
          <p>Não vendemos, alugamos nem compartilhamos seus dados com terceiros para fins de marketing.</p>
        </Secao>

        <Secao titulo="8. Seus direitos (LGPD)">
          <p>
            Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a confirmar a existência de tratamento de dados, acessar seus dados,
            corrigir dados incompletos ou desatualizados, solicitar a exclusão de dados tratados com seu consentimento e revogar seu consentimento a qualquer momento.
          </p>
        </Secao>

        <Secao titulo="9. Como exercer seus direitos">
          <p>Entre em contato pelo telefone {empresa.telefoneExibicao} ou pelo endereço {empresa.endereco.linha1}, {empresa.endereco.linha2}.</p>
        </Secao>

        <Secao titulo="10. Alterações nesta política">
          <p>Podemos atualizar esta política periodicamente. A data da última atualização fica sempre no topo desta página.</p>
        </Secao>
      </div>
    </article>
  );
}
