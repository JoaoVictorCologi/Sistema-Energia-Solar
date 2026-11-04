import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AlertaDaSimulacao, OrigemDaPremissa, Simulacao } from '../../services/api.ts';
import { formatarAnos, formatarData, formatarNumero, formatarPercentual, formatarReais, rotuloDoMes } from '../../utils/formatar.ts';

// Peças comuns ao resultado público da simulação e ao orçamento da área restrita.

// Os alertas de inversor (razão CC/CA, ceifamento, sem inversor compatível) são técnicos e aparecem apenas no orçamento.
const ALERTAS_DO_VISITANTE = [
  'CONSUMO_ABAIXO_DO_MINIMO', 'CREDITOS_VENCIDOS', 'TIR_NAO_CALCULAVEL', 'TARIFA_DESATUALIZADA',
  'FIO_B_DA_VIGENCIA_ANTERIOR', 'PREMISSAS_NAO_CALIBRADAS', 'ESTIMATIVA_FORA_DA_REGIAO_CALIBRADA',
  'CONTA_FORA_DO_ESPERADO', 'AREA_INSUFICIENTE', 'VISITA_TECNICA_RECOMENDADA', 'AMPLIACAO_LIMITADA',
];

export const NOMES_DA_LIGACAO = { monofasico: 'monofásica', bifasico: 'bifásica', trifasico: 'trifásica' } as const;

// A resposta da API não repete o aumento previsto: ele é a diferença entre o consumo dos meses, que já o inclui, e o consumo informado.
// Serve apenas à exibição, para a tela não apresentar como atual um consumo que inclui o aumento pretendido.
export function aumentoPrevistoKwh({ pedido, primeiroAno }: Pick<Simulacao, 'pedido' | 'primeiroAno'>): number {
  const media = primeiroAno.reduce((soma, mes) => soma + mes.consumoKwh, 0) / primeiroAno.length;
  const aumento = Math.round(media - pedido.consumoMedioKwh);
  return aumento > 0 ? aumento : 0;
}

// `todos`: inclui os alertas técnicos, usados no orçamento.
export function Alertas({ alertas, todos = false }: { alertas: AlertaDaSimulacao[]; todos?: boolean }) {
  const visiveis = todos ? alertas : alertas.filter((alerta) => ALERTAS_DO_VISITANTE.includes(alerta.codigo));
  if (visiveis.length === 0) return null;
  return (
    <ul className="mt-8 flex max-w-3xl flex-col gap-3">
      {visiveis.map((alerta) => (
        <li key={alerta.codigo} className="flex items-start gap-3 rounded-md border border-brand-orange/50 bg-brand-orange/10 px-4 py-3 text-sm text-brand-ink">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span><span className="sr-only">Atenção: </span>{alerta.mensagem}</span>
        </li>
      ))}
    </ul>
  );
}

export function Cartao({ rotulo, valor, children }: { rotulo: string; valor: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-white p-6 break-inside-avoid">
      <dt className="text-sm font-semibold text-muted-foreground">{rotulo}</dt>
      <dd className="mt-3 font-heading text-3xl font-medium tracking-tight text-brand-blue tabular-nums">{valor}</dd>
      <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</dd>
    </div>
  );
}

export function descreverSistema({ numeroModulos, potenciaModuloW, inversorKw }: Simulacao['dimensionamento']): string {
  const inversor = inversorKw === null ? 'sem inversor de referência compatível' : `inversor de ${formatarNumero(inversorKw)} kW`;
  return `${numeroModulos} módulos de ${potenciaModuloW} W e ${inversor}.`;
}

export const NOMES_DA_ORIGEM: Record<OrigemDaPremissa, string> = { informado: 'informado', estimado: 'estimado', revisado: 'revisado' };

// `origem`: indica se o dado foi informado pelo cliente, estimado ou revisado pela equipe.
function Linha({ termo, origem, children }: { termo: string; origem?: OrigemDaPremissa; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 py-3 print:py-1">
      <dt className="text-muted-foreground">
        {termo}
        {origem && <span className={'ml-2 text-xs font-semibold ' + (origem === 'estimado' ? 'text-muted-foreground' : 'text-brand-blue')}>({NOMES_DA_ORIGEM[origem]})</span>}
      </dt>
      <dd className="text-right font-medium text-brand-ink tabular-nums">{children}</dd>
    </div>
  );
}

export function ListaDePremissas({ premissas, indicadores }: Pick<Simulacao, 'premissas' | 'indicadores'>) {
  const { origem } = premissas;
  return (
    <dl className="divide-y divide-border border-y border-border text-sm">
      <Linha termo="Distribuidora">{premissas.distribuidora}</Linha>
      <Linha termo="Tarifa com impostos" origem={origem?.tributos}>{formatarReais(premissas.tarifaComImpostos)}/kWh</Linha>
      <Linha termo="Vigência da tarifa (ANEEL)">{formatarData(premissas.vigenciaDaTarifa.inicio)} a {formatarData(premissas.vigenciaDaTarifa.fim)}</Linha>
      <Linha termo="Regra da Lei 14.300">{premissas.regime === 'GD_I' ? 'GD I (sem cobrança de Fio B)' : 'GD II'}</Linha>
      <Linha termo="Fio B (ANEEL)">{formatarNumero(premissas.tarifaSemImpostos.fioB, 6)} R$/kWh</Linha>
      <Linha termo={origem?.tributos === 'informado' ? 'ICMS tirado da sua conta' : 'ICMS do estado'}>{formatarPercentual(premissas.tributos.icms)}</Linha>
      <Linha termo="Sol médio do município (INPE)">{formatarNumero(premissas.hspMedio, 2)} kWh/m² por dia</Linha>
      {premissas.telhado && <Linha termo="Aproveitamento do sol no telhado" origem={origem?.telhado}>{formatarPercentual(premissas.telhado.fator)}</Linha>}
      <Linha termo="Aproveitamento do sistema" origem={origem?.performanceRatio}>{formatarPercentual(premissas.performanceRatio)}</Linha>
      <Linha termo="Consumo no mesmo horário da geração" origem={origem?.simultaneidade}>{formatarPercentual(premissas.simultaneidade)}</Linha>
      {origem && <Linha termo="Consumo ao longo do ano" origem={origem.consumoMensal}>{origem.consumoMensal === 'informado' ? 'Mês a mês' : 'Média repetida'}</Linha>}
      <Linha termo="Consumo mínimo da ligação">{formatarNumero(premissas.consumoMinimoKwh)} kWh</Linha>
      <Linha termo="Reajuste anual da tarifa (IPCA)">{formatarPercentual(premissas.reajusteAnual)}</Linha>
      <Linha termo="Taxa de desconto (Selic)">{formatarPercentual(premissas.taxaDesconto)}</Linha>
      <Linha termo="Conexão prevista">{rotuloDoMes(premissas.inicio.ano, premissas.inicio.mes)}</Linha>
      <Linha termo="Retorno com desconto">{formatarAnos(indicadores.paybackDescontadoAnos)}</Linha>
      <Linha termo="Taxa interna de retorno">{indicadores.tir === null ? 'Não calculável' : `${formatarPercentual(indicadores.tir)} ao ano`}</Linha>
      <Linha termo="Valor presente líquido">{formatarReais(indicadores.vpl, true)}</Linha>
    </dl>
  );
}
