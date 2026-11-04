// Troca valores típicos pelo que o cliente informou. Cada resposta é opcional e não confiável:
// fora da faixa, é ignorada e o resultado avisa. Tudo aqui é cálculo puro, sem banco nem rede.
import { Decimal } from 'decimal.js';
import { parcelaPrice } from '../motor/financeiro.ts';
import type { RegimeGd } from '../motor/faturamento.ts';
import type { Alerta } from '../motor/tipos.ts';
import { parametros } from '../parametros/parametros.ts';
import type { FormaDePagamento } from '../repositories/configuracoesRepository.ts';
import type { TipoDePagamento } from '../tipos/tabelas.ts';

export type Subgrupo = 'B1' | 'B2' | 'B3';
export type PerfilDeConsumo = 'noite' | 'equilibrado' | 'dia';
export type HorasDeSol = keyof typeof parametros.telhado.horasDeSol;
export type Orientacao = keyof typeof parametros.telhado.orientacao;
export type Inclinacao = keyof typeof parametros.telhado.inclinacao;

export interface TelhadoInformado {
  horasDeSol?: HorasDeSol;
  orientacao?: Orientacao;
  inclinacao?: Inclinacao;
  tipo?: 'ceramica' | 'metalico' | 'fibrocimento' | 'laje' | 'solo';
  areaM2?: Decimal;
}

// As respostas do cliente no formulário da simulação (todas opcionais).
export interface RespostasDoCliente {
  conta?: { valorReais: Decimal; consumoKwh: Decimal; iluminacaoPublicaReais?: Decimal };
  consumoMensalKwh?: Decimal[];
  perfilDeConsumo?: PerfilDeConsumo;
  telhado?: TelhadoInformado;
  solarExistente?: { protocoloEm: string };
  aumentoPrevistoKwh?: Decimal;
  pagamentoPreferido?: TipoDePagamento;
}

// O que o operador pode mudar na revisão do orçamento, sempre dentro das faixas.
export interface RevisaoDePremissas {
  performanceRatio?: Decimal;
  simultaneidade?: Decimal;
  telhado?: Pick<TelhadoInformado, 'horasDeSol' | 'orientacao' | 'inclinacao'>;
  quantidadeDeModulos?: number;
}

export type Origem = 'informado' | 'estimado' | 'revisado';

// Lei 14.300, art. 26: protocolo até 07/01/2023 fica na regra antiga, sem Fio B até 2045.
const ULTIMO_PROTOCOLO_GD_I = '2023-01-07';

export function regimeDoPedido(solarExistente: RespostasDoCliente['solarExistente']): RegimeGd {
  return solarExistente && solarExistente.protocoloEm <= ULTIMO_PROTOCOLO_GD_I ? 'GD_I' : 'GD_II';
}

export function simultaneidadeDoPedido(subgrupo: Subgrupo, perfil: PerfilDeConsumo | undefined): Decimal {
  return parametros.simultaneidade[subgrupo][perfil ?? 'padrao'];
}

// Orientação × inclinação × horas de sol: o Atlas vale para telhado voltado ao norte, inclinado na latitude e sem sombra.
export function fatorDoTelhado(telhado: Pick<TelhadoInformado, 'horasDeSol' | 'orientacao' | 'inclinacao'> | undefined): Decimal {
  const fatores = parametros.telhado;
  return new Decimal(1)
    .times(telhado?.orientacao ? fatores.orientacao[telhado.orientacao] : 1)
    .times(telhado?.inclinacao ? fatores.inclinacao[telhado.inclinacao] : 1)
    .times(telhado?.horasDeSol ? fatores.horasDeSol[telhado.horasDeSol] : 1);
}

// Pelo menos um módulo: área muito pequena já traz o alerta de área insuficiente.
export function modulosNaArea(areaM2: Decimal | undefined): number | undefined {
  if (areaM2 === undefined) return undefined;
  return Math.max(1, areaM2.div(parametros.telhado.areaPorModuloM2).floor().toNumber());
}

// Consumo do cálculo: o histórico (ou a média repetida), mais o aumento previsto.
export function consumoDoPedido(consumoMedio: Decimal, respostas: RespostasDoCliente): Decimal[] {
  const base = respostas.consumoMensalKwh ?? Array.from({ length: 12 }, () => consumoMedio);
  return base.map((consumo) => consumo.plus(respostas.aumentoPrevistoKwh ?? 0));
}

// Com aumento previsto, o sistema cobre o consumo futuro só até o limite sobre o consumo de hoje:
// a distribuidora costuma pedir comprovação de carga acima disso.
export function coberturaDoPedido(coberturaPadrao: Decimal, consumoMedio: Decimal, respostas: RespostasDoCliente): Decimal {
  if (!respostas.aumentoPrevistoKwh?.gt(0)) return coberturaPadrao;
  const futuro = consumoMedio.plus(respostas.aumentoPrevistoKwh);
  return Decimal.min(coberturaPadrao, consumoMedio.times(parametros.coberturaMaximaSobreConsumoAtual).div(futuro));
}

// Tarifa efetiva = (valor − iluminação pública) ÷ kWh. Devolve a alíquota total implícita, 1 − (TE + TUSD) ÷ tarifa efetiva,
// ou null quando a conta não faz sentido (digitação errada, conta com compensação de quem já tem solar).
export function aliquotaDaConta(conta: RespostasDoCliente['conta'], tarifaSemImpostos: Decimal, tarifaCalculada: Decimal): Decimal | null {
  if (!conta) return null;
  const faixas = parametros.contaDeLuz;
  const tarifaEfetiva = conta.valorReais.minus(conta.iluminacaoPublicaReais ?? 0).div(conta.consumoKwh);
  if (tarifaEfetiva.lte(0)) return null;
  const aliquota = new Decimal(1).minus(tarifaSemImpostos.div(tarifaEfetiva));
  const distancia = tarifaEfetiva.minus(tarifaCalculada).abs().div(tarifaCalculada);
  if (aliquota.lt(faixas.aliquotaImplicitaMinima) || aliquota.gt(faixas.aliquotaImplicitaMaxima) || distancia.gt(faixas.toleranciaDaTarifa)) return null;
  return aliquota;
}

export interface OrigemDasPremissas {
  performanceRatio: Origem;
  simultaneidade: Origem;
  tributos: Origem;
  telhado: Origem;
  consumoMensal: Origem;
}

export function origemDasPremissas(respostas: RespostasDoCliente, contaUsada: boolean, revisao: RevisaoDePremissas = {}): OrigemDasPremissas {
  const { telhado } = respostas;
  return {
    performanceRatio: revisao.performanceRatio ? 'revisado' : 'estimado',
    simultaneidade: revisao.simultaneidade ? 'revisado' : respostas.perfilDeConsumo ? 'informado' : 'estimado',
    tributos: contaUsada ? 'informado' : 'estimado',
    telhado: revisao.telhado ? 'revisado' : telhado?.horasDeSol || telhado?.orientacao || telhado?.inclinacao ? 'informado' : 'estimado',
    consumoMensal: respostas.consumoMensalKwh ? 'informado' : 'estimado',
  };
}

export function alertasDasRespostas(respostas: RespostasDoCliente, contaIgnorada: boolean, consumoMedio: Decimal): Alerta[] {
  const alertas: Alerta[] = [];
  if (contaIgnorada) {
    alertas.push({ codigo: 'CONTA_FORA_DO_ESPERADO', mensagem: 'Os valores da conta informada ficaram fora do esperado para esta região: usamos a tarifa oficial com os impostos do estado.' });
  }
  if (respostas.telhado?.horasDeSol === 'menosDe4') {
    alertas.push({ codigo: 'VISITA_TECNICA_RECOMENDADA', mensagem: 'Com menos de 4 horas de sol direto, o aproveitamento do telhado precisa ser avaliado numa visita técnica.' });
  }
  const aumento = respostas.aumentoPrevistoKwh;
  if (aumento?.gt(0) && consumoMedio.times(parametros.coberturaMaximaSobreConsumoAtual).lt(consumoMedio.plus(aumento))) {
    alertas.push({ codigo: 'AMPLIACAO_LIMITADA', mensagem: 'O sistema foi limitado a 120% do consumo atual: acima disso, a distribuidora costuma pedir comprovação do aumento de carga.' });
  }
  return alertas;
}

export interface ParcelaEstimada {
  forma: string;
  tipo: TipoDePagamento;
  parcelas: number;
  entrada: number;
  taxaMensal: number;
  valorParcela: number;
}

// A forma preferida pelo cliente, ou o financiamento como referência. Entre as do tipo, a de menor taxa.
export function estimarParcela(investimento: Decimal, preferido: TipoDePagamento | undefined, formasAtivas: FormaDePagamento[]): ParcelaEstimada | null {
  const tipo = preferido ?? 'financiado';
  const [forma] = formasAtivas.filter((item) => item.tipo === tipo)
    .sort((a, b) => (a.taxaMensal ?? new Decimal(0)).comparedTo(b.taxaMensal ?? new Decimal(0)));
  if (!forma) return null;
  if (tipo === 'avista') {
    return { forma: forma.nome, tipo, parcelas: 1, entrada: 0, taxaMensal: 0, valorParcela: investimento.times(new Decimal(1).minus(forma.descontoAvista)).toDecimalPlaces(2).toNumber() };
  }
  const entrada = investimento.times(forma.entradaMinima).toDecimalPlaces(2);
  const taxaMensal = forma.taxaMensal ?? new Decimal(0);
  const valorParcela = parcelaPrice(investimento.minus(entrada), taxaMensal, forma.parcelasMaximas).toDecimalPlaces(2).toNumber();
  return { forma: forma.nome, tipo, parcelas: forma.parcelasMaximas, entrada: entrada.toNumber(), taxaMensal: taxaMensal.toNumber(), valorParcela };
}
