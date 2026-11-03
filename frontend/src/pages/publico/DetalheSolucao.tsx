import { Link, useParams } from 'react-router';
import { ChamadaFinal, linkDoContato } from '../../components/publico/ChamadaFinal.tsx';
import { FotoAcervo } from '../../components/publico/FotoAcervo.tsx';
import { linkDoWhatsApp } from '../../dados/empresa.ts';
import { solucoes, type Solucao } from '../../dados/solucoes.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { NaoEncontrada } from './NaoEncontrada.tsx';

const classeDoCaminho = 'inline-flex min-h-11 items-center underline underline-offset-4';

export function DetalheSolucao() {
  const { slug } = useParams();
  const solucao = solucoes.find((item) => item.slug === slug);
  return solucao ? <ConteudoDaSolucao solucao={solucao} /> : <NaoEncontrada />;
}

function ConteudoDaSolucao({ solucao }: { solucao: Solucao }) {
  useTituloDaPagina(`${solucao.nome} — Don Energy`);

  return (
    <>
      <section className="site-shell pt-8 pb-20 md:pt-12">
        <nav aria-label="Caminho da página" className="mb-8 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          <Link to="/" className={classeDoCaminho}>Início</Link>
          <span aria-hidden="true">/</span>
          <Link to="/solucoes" className={classeDoCaminho}>Soluções</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{solucao.titulo}</span>
        </nav>
        <div className="grid items-center gap-10 md:grid-cols-2 lg:gap-16">
          <div>
            <p className="site-eyebrow">{solucao.nome}</p>
            <h1 className="font-heading text-4xl leading-tight font-medium tracking-[-0.04em] text-brand-blue lg:text-5xl">{solucao.abertura}</h1>
            <p className="mt-6 leading-relaxed text-muted-foreground">{solucao.resumo}</p>
            <Link to={linkDoContato(solucao.slug)} className="site-button mt-7">
              Conversar sobre meu projeto <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <figure>
            <FotoAcervo numero={solucao.foto} carregarJa className="aspect-[4/3]" />
            <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">Acervo Don Energy · perfil da instalação em conferência.</figcaption>
          </figure>
        </div>
      </section>

      <section className="site-section bg-brand-soft">
        <div className="site-shell grid gap-12 md:grid-cols-2 lg:gap-24">
          <div>
            <p className="site-eyebrow">O que considerar</p>
            <h2 className="site-title">{solucao.contexto}</h2>
            <p className="mt-7 leading-relaxed text-muted-foreground">{solucao.necessidade}</p>
          </div>
          <div>
            <h3 className="font-heading text-xl font-medium text-brand-blue">Informações para avaliar o projeto</h3>
            <p className="mt-5 leading-relaxed text-muted-foreground">{solucao.solucao}</p>
            <ul className="mt-7 divide-y divide-border border-y border-border">
              {solucao.pontos.map((ponto) => <li key={ponto} className="py-4 text-sm text-brand-blue">{ponto}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-shell">
          <p className="site-eyebrow">Antes da proposta</p>
          <h2 className="site-title">Informações para a primeira conversa.</h2>
          <ol className="mt-12 grid gap-9 md:grid-cols-3">
            {solucao.etapas.map((etapa, posicao) => (
              <li key={etapa.titulo} className="border-t border-border pt-6">
                <span aria-hidden="true" className="text-xs font-semibold text-brand-blue">0{posicao + 1}</span>
                <h3 className="mt-6 font-heading text-xl font-medium text-brand-blue">{etapa.titulo}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{etapa.texto}</p>
              </li>
            ))}
          </ol>
          <p className="mt-7 text-sm leading-relaxed text-muted-foreground">Escopo, prazos e responsabilidades precisam ser esclarecidos na proposta do projeto.</p>
        </div>
      </section>

      <section className="site-section bg-brand-soft">
        <div className="site-shell grid gap-10 md:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <p className="site-eyebrow">Dúvidas deste perfil</p>
            <h2 className="site-title">Para começar<br /> com mais clareza.</h2>
          </div>
          <div>
            {solucao.perguntas.map((item) => (
              <details key={item.pergunta} className="mb-5 border-b border-border pb-3">
                <summary className="min-h-12 cursor-pointer rounded-sm py-3 font-semibold text-brand-blue">{item.pergunta}</summary>
                <p className="py-3 text-sm leading-relaxed text-muted-foreground">{item.resposta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <ChamadaFinal slugDaSolucao={solucao.slug} />
      <div className="site-shell flex flex-wrap gap-x-8 py-7">
        <Link to="/solucoes" className="site-link">Conhecer os outros perfis solares</Link>
        <a href={linkDoWhatsApp(solucao.mensagemDoWhatsApp)} target="_blank" rel="noopener noreferrer" className="site-link">
          Conversar direto no WhatsApp <span aria-hidden="true">↗</span>
        </a>
      </div>
    </>
  );
}
