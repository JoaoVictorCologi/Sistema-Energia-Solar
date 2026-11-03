import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AlertaDaSimulacao, Simulacao } from '../../services/api.ts';
import { formatarAnos, formatarData, formatarNumero, formatarPercentual, formatarReais, rotuloDoMes } from '../../utils/formatar.ts';

// Peças comuns ao resultado público da simulação e à proposta do administrador.

// Os de inversor (razão CC/CA, ceifamento, sem inversor compatível) são técnicos: só a proposta mostra.
const ALERTAS_DO_VISITANTE = [
  'CONSUMO_ABAIXO_DO_MINIMO', 'CREDITOS_VENCIDOS', 'TIR_NAO_CALCULAVEL', 'TARIFA_DESATUALIZADA',
  'FIO_B_DA_VIGENCIA_ANTERIOR', 'ESTIMATIVA_FORA_DA_REGIAO_CALIBRADA',
];

export const NOMES_DA_LIGACAO = { monofasico: 'monofásica', bifasico: 'bifásica', trifasico: 'trifásica' } as const;

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

function Linha({ termo, children }: { termo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 py-3">
      <dt className="text-muted-foreground">{termo}</dt>
      <dd className="text-right font-medium text-brand-ink tabular-nums">{children}</dd>
    </div>
  );
}

export function ListaDePremissas({ premissas, indicadores }: Pick<Simulacao, 'premissas' | 'indicadores'>) {
  return (
    <dl className="divide-y divide-border border-y border-border text-sm">
      <Linha termo="Distribuidora">{premissas.distribuidora}</Linha>
      <Linha termo="Tarifa com impostos">{formatarReais(premissas.tarifaComImpostos)}/kWh</Linha>
      <Linha termo="Vigência da tarifa (ANEEL)">{formatarData(premissas.vigenciaDaTarifa.inicio)} a {formatarData(premissas.vigenciaDaTarifa.fim)}</Linha>
      <Linha termo="Fio B (Lei 14.300, GD II)">{formatarNumero(premissas.tarifaSemImpostos.fioB, 6)} R$/kWh</Linha>
      <Linha termo="ICMS do estado">{formatarPercentual(premissas.tributos.icms)}</Linha>
      <Linha termo="Sol médio do município (INPE)">{formatarNumero(premissas.hspMedio, 2)} kWh/m² por dia</Linha>
      <Linha termo="Aproveitamento do sistema">{formatarPercentual(premissas.performanceRatio)}</Linha>
      <Linha termo="Consumo no mesmo horário da geração">{formatarPercentual(premissas.simultaneidade)}</Linha>
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
