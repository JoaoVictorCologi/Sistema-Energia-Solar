import { Link } from 'react-router';
import { FormularioSimulacao } from '../../components/simulador/FormularioSimulacao.tsx';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';

// Mesmo layout do simulador do site anterior: formulário à esquerda e explicação à direita.
export function Simulador() {
  useTituloDaPagina('Simulador solar — Don Energy');

  return (
    <>
      <section className="site-shell pt-14 pb-12 md:pt-20 md:pb-16">
        <p className="site-eyebrow">Simulador solar · Lei 14.300</p>
        <h1 className="max-w-3xl font-heading text-4xl leading-tight font-medium tracking-[-0.04em] text-brand-blue sm:text-5xl">
          Um primeiro olhar.<br />Uma conversa mais clara.
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Informe o CEP, o tipo de ligação e o consumo médio. Em segundos você vê o sistema indicado, a economia estimada pelas regras
          da Lei 14.300 e o tempo de retorno.
        </p>
      </section>

      <div className="site-shell grid items-start gap-10 pb-20 lg:grid-cols-[1.3fr_0.8fr] lg:gap-20">
        <section aria-labelledby="titulo-do-formulario" className="rounded-md border border-border bg-background p-6 sm:p-8">
          <h2 id="titulo-do-formulario" className="mb-8 font-heading text-2xl font-medium tracking-tight text-brand-blue">Seus dados de consumo</h2>
          <FormularioSimulacao />
        </section>
        <ExplicacaoDoCalculo />
      </div>
    </>
  );
}

function ExplicacaoDoCalculo() {
  return (
    <aside aria-labelledby="titulo-da-explicacao" className="rounded-md bg-brand-soft p-6 sm:p-8 lg:p-10">
      <p className="site-eyebrow">De onde vêm os números</p>
      <h2 id="titulo-da-explicacao" className="font-heading text-2xl leading-snug font-medium tracking-tight text-brand-blue">
        Dados oficiais.<br />Regras da Lei 14.300.
      </h2>
      <div className="mt-8 space-y-7 border-t border-border pt-7">
        <div>
          <h3 className="font-heading text-base font-medium text-brand-blue">Tarifa da distribuidora</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Tarifa de energia e Fio B publicados pela ANEEL e atualizados automaticamente.</p>
        </div>
        <div>
          <h3 className="font-heading text-base font-medium text-brand-blue">Sol do seu município</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Irradiação mensal do Atlas Brasileiro de Energia Solar (INPE).</p>
        </div>
        <div>
          <h3 className="font-heading text-base font-medium text-brand-blue">Uma estimativa, não uma proposta</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">O investimento é estimado; o valor final vem na proposta, depois da avaliação do local.</p>
        </div>
      </div>
      <Link to="/metodologia" className="site-link mt-6">Ver metodologia e fontes <span aria-hidden="true">↗</span></Link>
    </aside>
  );
}
