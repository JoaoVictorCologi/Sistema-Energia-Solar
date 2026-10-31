import { Clock, MapPin, Phone } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { empresa, linkDoWhatsApp } from '../../../dados/empresa.ts';
import { solucoes } from '../../../dados/solucoes.ts';
import { useTituloDaPagina } from '../../../hooks/useTituloDaPagina.ts';
import { FormularioContato } from '../components/FormularioContato.tsx';
import { MapaContato } from '../components/MapaContato.tsx';

// Página de contato herdada do site Don Energy (app/contato/page.tsx).
export function Contato() {
  useTituloDaPagina('Contato — Don Energy');
  const [parametros] = useSearchParams();
  // ?servico=<slug> vem dos botões das páginas de solução e já marca o perfil no formulário.
  const perfil = solucoes.find((solucao) => solucao.slug === parametros.get('servico'))?.slug ?? '';

  return (
    <>
      <section className="site-shell pt-14 pb-10 md:pt-20">
        <p className="site-eyebrow">Vamos conversar</p>
        <h1 className="max-w-3xl font-heading text-4xl leading-tight font-medium tracking-[-0.04em] text-brand-blue sm:text-5xl">Qual é o seu próximo passo?</h1>
        <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
          Conte sobre o seu projeto solar. Prepare uma mensagem pelo formulário ou fale diretamente com a Don Energy.
        </p>
      </section>
      <div className="site-shell grid items-start gap-10 pb-20 lg:grid-cols-[1.3fr_0.8fr] lg:gap-20">
        <section id="formulario-proposta" aria-label="Solicitar proposta solar" className="scroll-mt-[calc(var(--header-height)+1rem)]">
          <FormularioContato key={perfil} perfilInicial={perfil} compacto />
        </section>
        <InformacoesDeContato />
      </div>
      <MapaContato />
    </>
  );
}

function InformacoesDeContato() {
  return (
    <aside aria-label="Informações de contato" className="space-y-8 lg:pt-6">
      <div>
        <Phone aria-hidden="true" className="mb-4 size-5 text-brand-blue" />
        <h2 className="font-heading text-xl font-medium text-brand-blue">Fale com a Don Energy</h2>
        <a href={linkDoWhatsApp()} target="_blank" rel="noopener noreferrer" className="site-link mt-3">Conversar no WhatsApp <span aria-hidden="true">↗</span></a>
        <p className="mt-2 text-sm text-muted-foreground">
          Ou ligue: <a href={`tel:${empresa.telefoneInternacional}`} className="underline underline-offset-4">{empresa.telefoneExibicao}</a>
        </p>
      </div>
      <div className="border-t border-border pt-7">
        <MapPin aria-hidden="true" className="mb-4 size-5 text-brand-blue" />
        <h2 className="font-heading text-xl font-medium text-brand-blue">Encontre a gente</h2>
        <address className="mt-4 text-sm leading-relaxed text-muted-foreground not-italic">
          {empresa.endereco.linha1}<br />{empresa.endereco.linha2}
        </address>
      </div>
      <div className="border-t border-border pt-7">
        <Clock aria-hidden="true" className="mb-4 size-5 text-brand-blue" />
        <h2 className="font-heading text-xl font-medium text-brand-blue">Atendimento</h2>
        <dl className="mt-4 space-y-4 text-sm">
          {empresa.horarios.map((item) => (
            <div key={item.dias}>
              <dt className="font-medium">{item.dias}</dt>
              <dd className="mt-1 text-muted-foreground">{item.horario}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}
