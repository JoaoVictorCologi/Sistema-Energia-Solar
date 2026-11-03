import { ArrowDown } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';
import { Alertas, Cartao, descreverSistema, ListaDePremissas, NOMES_DA_LIGACAO } from '../../components/simulador/BlocosDoResultado.tsx';
import { GraficoConsumoGeracao, TabelaMesAMes } from '../../components/simulador/GraficoConsumoGeracao.tsx';
import { GraficoDoRetorno, TabelaAnoAAno } from '../../components/simulador/GraficoDoRetorno.tsx';
import { PedidoDeProposta } from '../../components/simulador/PedidoDeProposta.tsx';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import type { MesDoPrimeiroAno, Simulacao } from '../../services/api.ts';
import { formatarAnos, formatarNumero, formatarPercentual, formatarReais } from '../../utils/formatar.ts';

// A simulação chega pelo estado da navegação, vinda do formulário. Sem ela (link direto), volta ao formulário.
export function ResultadoSimulacao() {
  const simulacao = (useLocation().state as { simulacao?: Simulacao } | null)?.simulacao;
  useTituloDaPagina('Resultado da simulação — Don Energy');
  if (!simulacao) return <Navigate to="/simulador" replace />;

  return (
    <>
      <DestaqueDaEconomia simulacao={simulacao} />
      <NumerosPrincipais simulacao={simulacao} />
      <SecaoDoRetorno simulacao={simulacao} />

      <section aria-labelledby="titulo-do-grafico" className="site-section">
        <div className="site-shell">
          <p className="site-eyebrow">Primeiro ano</p>
          <h2 id="titulo-do-grafico" className="site-title">Consumo × geração, mês a mês.</h2>
          <div className="mt-10"><GraficoConsumoGeracao meses={simulacao.primeiroAno} /></div>
          <TabelaMesAMes meses={simulacao.primeiroAno} />
        </div>
      </section>

      <section className="site-section bg-brand-soft">
        <div className="site-shell grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <Premissas simulacao={simulacao} />
          <div id="proposta" className="scroll-mt-[calc(var(--header-height)+1rem)]">
            <PedidoDeProposta codigoDaSimulacao={simulacao.codigo} />
          </div>
        </div>
      </section>

      <div className="site-shell flex flex-wrap gap-x-8 py-7">
        <Link to="/simulador" className="site-link">Fazer outra simulação</Link>
        <Link to="/metodologia" className="site-link">Como o cálculo é feito <span aria-hidden="true">↗</span></Link>
      </div>
    </>
  );
}

// Só exibição: média das contas mensais que o backend já calculou, para comparar "hoje" com "com solar".
function compararContas(meses: MesDoPrimeiroAno[]) {
  const media = (valores: number[]) => valores.reduce((soma, valor) => soma + valor, 0) / Math.max(valores.length, 1);
  const hoje = media(meses.map((mes) => mes.faturaSemSolar));
  const comSolar = media(meses.map((mes) => mes.faturaComSolar));
  return { hoje, comSolar, reducao: hoje > 0 ? 1 - comSolar / hoje : 0 };
}

// Primeira dobra: a economia por mês é o número que o visitante veio buscar, então é ele que aparece grande.
function DestaqueDaEconomia({ simulacao }: { simulacao: Simulacao }) {
  const { local, pedido, dimensionamento, indicadores } = simulacao;
  return (
    <section className="bg-brand-deep text-white">
      <div className="site-shell grid items-center gap-12 pt-14 pb-16 md:pt-20 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        <div>
          <p className="mb-6 text-xs font-semibold tracking-[0.13em] text-white/85 uppercase">
            Sua simulação · {local.cidade} / {local.uf} · {simulacao.premissas.distribuidora}
          </p>
          <h1 className="font-heading font-medium">
            <span className="block text-xl leading-snug text-balance text-white/90 sm:text-2xl">Com energia solar, você pode economizar cerca de</span>
            <span className="mt-3 block text-[clamp(3.5rem,11vw,6.5rem)] leading-none tracking-[-0.045em] text-brand-orange">
              {formatarReais(indicadores.economiaMensalMedia, true)}
              <span className="ml-2 text-2xl tracking-normal text-white sm:text-3xl">por mês</span>
            </span>
          </h1>
          <p className="mt-7 max-w-xl leading-relaxed text-white/90">
            São <strong className="font-semibold text-white">{formatarReais(indicadores.economiaPrimeiroAno, true)} no primeiro ano</strong> e{' '}
            <strong className="font-semibold text-white">{formatarReais(indicadores.economiaTotal, true)} em 25 anos</strong>, com um sistema de{' '}
            {formatarNumero(dimensionamento.kwpInstalado, 2)} kWp para o seu consumo de {formatarNumero(pedido.consumoMedioKwh)} kWh por mês
            (ligação {NOMES_DA_LIGACAO[pedido.tipoLigacao]}).
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href="#proposta" className="site-button">Quero minha proposta sem compromisso</a>
            <a href="#numeros" className="inline-flex min-h-12 items-center gap-2 text-sm font-medium underline underline-offset-8">
              Ver os números <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </div>
        </div>
        <ComparacaoDaConta meses={simulacao.primeiroAno} />
      </div>
    </section>
  );
}

// Duas barras na mesma escala: o tamanho da conta de hoje contra o da conta com solar.
function ComparacaoDaConta({ meses }: { meses: MesDoPrimeiroAno[] }) {
  const { hoje, comSolar, reducao } = compararContas(meses);
  const larguraComSolar = hoje > 0 ? Math.max((comSolar / hoje) * 100, 2) : 0;
  return (
    <div className="rounded-md bg-white p-6 text-brand-ink sm:p-8">
      <h2 className="text-sm font-semibold text-muted-foreground">Sua conta de luz, em média por mês</h2>
      <dl className="mt-6 flex flex-col gap-5">
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm">Hoje</dt>
            <dd className="font-heading text-2xl font-medium">{formatarReais(hoje, true)}</dd>
          </div>
          <div aria-hidden="true" className="mt-2 h-3 rounded-[4px] bg-[#9AA3B5]" />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm">Com energia solar</dt>
            <dd className="font-heading text-2xl font-medium text-brand-blue">{formatarReais(comSolar, true)}</dd>
          </div>
          <div aria-hidden="true" className="mt-2 h-3 rounded-[4px] bg-brand-blue" style={{ width: `${larguraComSolar}%` }} />
        </div>
      </dl>
      <p className="mt-7 border-t border-border pt-5 font-heading text-xl font-medium text-brand-blue">
        Uma conta {formatarPercentual(Math.round(reducao * 100) / 100)} menor.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Com solar, a conta não zera: fica a taxa mínima da ligação e o Fio B da Lei 14.300. Média do primeiro ano.
      </p>
    </div>
  );
}

function NumerosPrincipais({ simulacao }: { simulacao: Simulacao }) {
  const { dimensionamento, indicadores, investimentoEstimado } = simulacao;
  return (
    <section id="numeros" aria-label="Números principais" className="site-shell scroll-mt-[calc(var(--header-height)+1rem)] pt-12">
      <Alertas alertas={simulacao.alertas} />
      <dl className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao rotulo="Sistema indicado" valor={`${formatarNumero(dimensionamento.kwpInstalado, 2)} kWp`}>
          {descreverSistema(dimensionamento)}
        </Cartao>
        <Cartao rotulo="Investimento estimado" valor={formatarReais(investimentoEstimado.valor, true)}>
          <strong className="font-semibold text-brand-ink">Valor final na proposta,</strong> depois da avaliação do local.
        </Cartao>
        <Cartao rotulo="Retorno do investimento" valor={formatarAnos(indicadores.paybackSimplesAnos)}>
          Depois disso, a economia na conta fica com você.
        </Cartao>
        <Cartao rotulo="Economia em 25 anos" valor={formatarReais(indicadores.economiaTotal, true)}>
          Com o reajuste anual da tarifa e a perda natural de rendimento dos módulos.
        </Cartao>
      </dl>
    </section>
  );
}

function SecaoDoRetorno({ simulacao }: { simulacao: Simulacao }) {
  const { paybackSimplesAnos } = simulacao.indicadores;
  const ultimoAno = simulacao.resumoAnual.at(-1);
  return (
    <section aria-labelledby="titulo-do-retorno" className="site-section pb-0">
      <div className="site-shell">
        <p className="site-eyebrow">25 anos</p>
        <h2 id="titulo-do-retorno" className="site-title">
          {paybackSimplesAnos === null
            ? 'O investimento não se paga em 25 anos.'
            : `O sistema se paga em ${formatarAnos(paybackSimplesAnos)}. O resto é economia.`}
        </h2>
        {ultimoAno && (
          <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">
            Saldo ao fim de 25 anos, já descontado o investimento:{' '}
            <strong className="font-semibold text-brand-ink">{formatarReais(ultimoAno.fluxoAcumulado, true)}</strong>.
          </p>
        )}
        <div className="mt-10"><GraficoDoRetorno anos={simulacao.resumoAnual} /></div>
        <TabelaAnoAAno anos={simulacao.resumoAnual} />
      </div>
    </section>
  );
}

function Premissas({ simulacao }: { simulacao: Simulacao }) {
  return (
    <div>
      <p className="site-eyebrow">Premissas</p>
      <h2 className="site-title">O que entrou na conta.</h2>
      <p className="mt-5 leading-relaxed text-muted-foreground">
        Estimativa pelas regras da Lei 14.300, com a tarifa oficial da {simulacao.premissas.distribuidora}. A proposta confirma os números
        depois da avaliação do local.
      </p>
      <div className="mt-8"><ListaDePremissas premissas={simulacao.premissas} indicadores={simulacao.indicadores} /></div>
      <p className="mt-4 text-xs text-muted-foreground">Versão dos parâmetros: {simulacao.premissas.versaoParametros}. Simulação {simulacao.codigo.slice(0, 8)}.</p>
    </div>
  );
}
