import { ArrowDown, ListChecks } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';
import { Alertas, aumentoPrevistoKwh, Cartao, descreverSistema, ListaDePremissas, NOMES_DA_LIGACAO } from '../../components/simulador/BlocosDoResultado.tsx';
import { GraficoConsumoGeracao, TabelaMesAMes } from '../../components/simulador/GraficoConsumoGeracao.tsx';
import { GraficoDoRetorno, TabelaAnoAAno } from '../../components/simulador/GraficoDoRetorno.tsx';
import { PedidoDeProposta } from '../../components/simulador/PedidoDeProposta.tsx';
import type { EstadoDoResultado } from '../../components/simulador/dadosDaSimulacao.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import type { MesDoPrimeiroAno, Simulacao } from '../../services/api.ts';
import { formatarAnos, formatarNumero, formatarPercentual, formatarReais } from '../../utils/formatar.ts';

// A simulação chega pelo estado da navegação, vinda do formulário. Sem ela (link direto), a tela volta ao formulário.
export function ResultadoSimulacao() {
  const estado = useLocation().state as EstadoDoResultado | null;
  const simulacao = estado?.simulacao;
  useTituloDaPagina('Resultado da simulação — Don Energy');
  if (!simulacao) return <Navigate to="/simulador" replace />;

  return (
    <>
      <DestaqueDaEconomia simulacao={simulacao} />
      <NumerosPrincipais simulacao={simulacao} />
      {estado?.dados && <RevisarRespostas estado={estado} simulacao={simulacao} />}
      <SecaoDoRetorno simulacao={simulacao} />

      <section aria-labelledby="titulo-do-grafico" className="site-section">
        <div className="site-shell">
          <p className="site-eyebrow">Primeiro ano</p>
          <h2 id="titulo-do-grafico" className="site-title">Consumo × geração, mês a mês.</h2>
          <div className="mt-10"><GraficoConsumoGeracao meses={simulacao.primeiroAno} pedido={simulacao.pedido} /></div>
          <TabelaMesAMes meses={simulacao.primeiroAno} />
        </div>
      </section>

      <section className="site-section bg-brand-soft">
        <div className="site-shell grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <Premissas simulacao={simulacao} />
          <div id="proposta" className="scroll-mt-[calc(var(--header-height)+1rem)]">
            <PedidoDeProposta codigoDaSimulacao={simulacao.codigo} local={simulacao.local} />
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

// Apenas exibição: média das contas mensais já calculadas pelo backend, para comparar a conta sem e com solar.
function compararContas(meses: MesDoPrimeiroAno[]) {
  const media = (valores: number[]) => valores.reduce((soma, valor) => soma + valor, 0) / Math.max(valores.length, 1);
  const hoje = media(meses.map((mes) => mes.faturaSemSolar));
  const comSolar = media(meses.map((mes) => mes.faturaComSolar));
  return { hoje, comSolar, reducao: hoje > 0 ? 1 - comSolar / hoje : 0 };
}

// Primeira dobra: a economia por mês é a informação principal para o visitante e recebe o maior destaque.
function DestaqueDaEconomia({ simulacao }: { simulacao: Simulacao }) {
  const { local, pedido, dimensionamento, indicadores } = simulacao;
  const aumento = aumentoPrevistoKwh(simulacao);
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
            {aumento > 0 && <> mais {formatarNumero(aumento)} kWh de aumento previsto</>} (ligação {NOMES_DA_LIGACAO[pedido.tipoLigacao]}).
            {aumento > 0 && ' A economia compara as contas já com esse aumento.'}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href="#proposta" className="site-button">Quero minha proposta sem compromisso</a>
            <a href="#numeros" className="inline-flex min-h-12 items-center gap-2 text-sm font-medium underline underline-offset-8">
              Ver os números <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </div>
        </div>
        <ComparacaoDaConta meses={simulacao.primeiroAno} aumento={aumento} />
      </div>
    </section>
  );
}

// Duas barras na mesma escala: a conta sem solar e a conta com solar.
function ComparacaoDaConta({ meses, aumento }: { meses: MesDoPrimeiroAno[]; aumento: number }) {
  const { hoje, comSolar, reducao } = compararContas(meses);
  const larguraComSolar = hoje > 0 ? Math.max((comSolar / hoje) * 100, 2) : 0;
  return (
    <div className="rounded-md bg-white p-6 text-brand-ink sm:p-8">
      <h2 className="text-sm font-semibold text-muted-foreground">Sua conta de luz, em média por mês</h2>
      <dl className="mt-6 flex flex-col gap-5">
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm">{aumento > 0 ? 'Sem solar, com o aumento previsto' : 'Hoje'}</dt>
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
        {aumento > 0 && ` As duas contas já incluem os ${formatarNumero(aumento)} kWh por mês de aumento: a sua conta de hoje é menor.`}
      </p>
    </div>
  );
}

// Abaixo de 100% quando a área do telhado ou o limite de ampliação restringem o sistema; o alerta da simulação indica o motivo.
function Cobertura({ fracao }: { fracao: number }) {
  if (fracao >= 1) return null;
  return <p className="mt-5 text-sm text-muted-foreground">Com as suas respostas, o sistema cobre {formatarPercentual(fracao)} do consumo considerado.</p>;
}

// Valor de referência: forma ativa de menor taxa do tipo. Sem forma ativa, a API devolve null e o bloco não aparece.
function ParcelaDeReferencia({ simulacao }: { simulacao: Simulacao }) {
  const { parcelaEstimada: parcela, indicadores } = simulacao;
  if (!parcela) return null;
  const avista = parcela.tipo === 'avista';
  return (
    <div className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-2 rounded-md border border-border bg-brand-soft p-5 text-sm">
      <p>
        <span className="font-semibold text-brand-ink">{parcela.forma}:</span>{' '}
        {avista
          ? <>{formatarReais(parcela.valorParcela, true)} à vista</>
          : <>{parcela.parcelas} parcelas de {formatarReais(parcela.valorParcela)}{parcela.entrada > 0 && <>, com entrada de {formatarReais(parcela.entrada, true)}</>}</>}
      </p>
      {!avista && <p>Economia estimada de {formatarReais(indicadores.economiaMensalMedia, true)} por mês.</p>}
      <p className="text-muted-foreground">Referência: as condições finais vêm no orçamento.</p>
    </div>
  );
}

const NOMES_DAS_PREMISSAS = {
  tributos: 'tarifa da sua conta',
  consumoMensal: 'consumo mês a mês',
  simultaneidade: 'horário de consumo',
  telhado: 'sol e direção do telhado',
  performanceRatio: 'aproveitamento do sistema',
} as const;

// Mostra o que veio do visitante e o que continua no valor típico, e permite voltar às perguntas com a conta de luz em mãos.
function RevisarRespostas({ estado, simulacao }: { estado: EstadoDoResultado; simulacao: Simulacao }) {
  const { origem } = simulacao.premissas;
  const chaves = Object.keys(NOMES_DAS_PREMISSAS) as (keyof typeof NOMES_DAS_PREMISSAS)[];
  const nomesCom = (valor: 'informado' | 'estimado') => chaves.filter((chave) => origem?.[chave] === valor).map((chave) => NOMES_DAS_PREMISSAS[chave]).join(', ');
  const informados = nomesCom('informado');
  return (
    <section aria-labelledby="titulo-respostas" className="site-shell pt-8">
      <div className="flex flex-col gap-5 rounded-md border border-brand-blue/30 bg-white p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 id="titulo-respostas" className="font-heading text-xl font-medium text-brand-blue">
            {informados ? 'Calculado com as suas respostas' : 'Calculado com valores típicos'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {informados
              ? <><strong className="font-semibold text-brand-ink">Informado por você:</strong> {informados}. <strong className="font-semibold text-brand-ink">Estimado:</strong> {nomesCom('estimado') || 'nada'}.</>
              : 'Você respondeu “não sei” às perguntas sobre a casa. Com a conta de luz na mão, o número fica mais perto do real.'}
          </p>
        </div>
        <Link to="/simulador" state={estado} className="site-button shrink-0">
          <ListChecks aria-hidden="true" className="size-4" /> Revisar minhas respostas
        </Link>
      </div>
    </section>
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
      <Cobertura fracao={simulacao.coberturaAlcancada} />
      <ParcelaDeReferencia simulacao={simulacao} />
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
        Estimativa pelas regras da Lei 14.300, com a tarifa oficial da {simulacao.premissas.distribuidora}. O valor final vem no orçamento dos
        nossos especialistas, depois da análise do local. Cada linha marcada diz se o dado foi informado por você ou estimado.
      </p>
      <div className="mt-8"><ListaDePremissas premissas={simulacao.premissas} indicadores={simulacao.indicadores} /></div>
      <p className="mt-4 text-xs text-muted-foreground">Versão dos parâmetros: {simulacao.premissas.versaoParametros}. Simulação {simulacao.codigo.slice(0, 8)}.</p>
    </div>
  );
}
