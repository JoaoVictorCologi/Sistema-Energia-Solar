import { ChamadaFinal } from '../../components/publico/ChamadaFinal.tsx';
import { CartaoSolucao } from '../../components/publico/CartaoSolucao.tsx';
import { solucoes } from '../../dados/solucoes.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';

export function Solucoes() {
  useTituloDaPagina('Soluções em energia solar — Don Energy');

  return (
    <>
      <section className="site-shell pt-14 pb-12 md:pt-20">
        <p className="site-eyebrow">Soluções solares</p>
        <h1 className="max-w-3xl font-heading text-4xl leading-tight font-medium tracking-[-0.04em] text-brand-blue sm:text-5xl">
          Um olhar para<br /> cada necessidade.
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Energia solar residencial, comercial, rural e usinas de investimento. Explore os critérios e as perguntas que ajudam a iniciar cada projeto.
        </p>
      </section>

      <section aria-label="Os quatro perfis solares" className="site-shell pb-20">
        <div className="grid gap-7 md:grid-cols-2">
          {solucoes.map((solucao, posicao) => <CartaoSolucao key={solucao.slug} solucao={solucao} carregarJa={posicao === 0} />)}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Fotografias do acervo Don Energy. A classificação das instalações por perfil está em conferência.
        </p>
      </section>

      <section className="site-section bg-brand-soft">
        <div className="site-shell">
          <p className="site-eyebrow">O contexto orienta a conversa</p>
          <h2 className="site-title">Necessidades diferentes.<br />Um ponto de partida próprio.</h2>
          <div className="mt-10">
            {solucoes.map((solucao) => (
              <article key={solucao.slug} className="grid gap-4 border-t border-border py-7 md:grid-cols-[1fr_1.6fr] md:gap-20">
                <h3 className="font-heading text-xl font-medium text-brand-blue">{solucao.titulo}</h3>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{solucao.necessidade}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ChamadaFinal />
    </>
  );
}
