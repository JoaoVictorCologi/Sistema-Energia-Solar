// O que a simulação devolve à tela e grava no banco: números arredondados só aqui, na saída
// (dinheiro com 2 casas, energia com 1, tarifas com 6, frações com 4).
import { Decimal } from 'decimal.js';
import type { EntradaSimulacao, ResultadoSimulacao } from '../motor/simular.ts';
import { tarifaComImpostos } from '../motor/tarifa.ts';
import type { TarifaGravada } from '../repositories/tarifasRepository.ts';
import type { LocalDoCep } from './cepService.ts';
import type { PedidoDeSimulacao } from './simulacaoService.ts';

export interface ContextoDaSimulacao {
  local: LocalDoCep;
  pedido: PedidoDeSimulacao;
  tarifa: TarifaGravada;
  distribuidora: string;
  versaoParametros: string;
}

const dinheiro = (valor: Decimal) => valor.toDecimalPlaces(2).toNumber();
const energia = (valor: Decimal) => valor.toDecimalPlaces(1).toNumber();
const tarifa = (valor: Decimal) => valor.toDecimalPlaces(6).toNumber();
const taxa = (valor: Decimal) => valor.toDecimalPlaces(4).toNumber();
const anos = (valor: Decimal | null) => (valor === null ? null : valor.toDecimalPlaces(1).toNumber());

function formatarPremissas(entrada: EntradaSimulacao, contexto: ContextoDaSimulacao) {
  const { premissas, tributos } = entrada;
  return {
    distribuidora: contexto.distribuidora,
    vigenciaDaTarifa: { inicio: contexto.tarifa.inicioVigencia, fim: contexto.tarifa.fimVigencia },
    tarifaSemImpostos: { te: tarifa(entrada.tarifa.te), tusd: tarifa(entrada.tarifa.tusd), fioB: tarifa(entrada.tarifa.fioB) },
    tarifaComImpostos: tarifa(tarifaComImpostos(entrada.tarifa, tributos)),
    tributos: { icms: taxa(tributos.icms), pis: taxa(tributos.pis), cofins: taxa(tributos.cofins) },
    hspMedio: Decimal.sum(...entrada.hspMensal).div(12).toDecimalPlaces(2).toNumber(),
    performanceRatio: taxa(premissas.performanceRatio),
    simultaneidade: taxa(premissas.simultaneidade),
    consumoMinimoKwh: energia(premissas.consumoMinimo),
    reajusteAnual: taxa(premissas.reajusteAnual),
    taxaDesconto: taxa(premissas.taxaDesconto),
    inicio: entrada.inicio,
    regime: entrada.regime,
    versaoParametros: contexto.versaoParametros,
  };
}

export function formatarSimulacao(entrada: EntradaSimulacao, resultado: ResultadoSimulacao, contexto: ContextoDaSimulacao) {
  const { dimensionamento, indicadores } = resultado;
  return {
    local: { cidade: contexto.local.cidade, uf: contexto.local.uf },
    pedido: { tipoLigacao: contexto.pedido.tipoLigacao, subgrupo: contexto.pedido.subgrupo, consumoMedioKwh: energia(contexto.pedido.consumoMedioKwh) },
    dimensionamento: {
      numeroModulos: dimensionamento.numeroModulos,
      potenciaModuloW: entrada.modulo.potenciaW.toNumber(),
      kwpInstalado: dimensionamento.kwpInstalado.toDecimalPlaces(2).toNumber(),
      inversorKw: dimensionamento.inversorKw?.toNumber() ?? null,
    },
    investimentoEstimado: { valor: dinheiro(entrada.investimento), aviso: 'Valor estimado; o valor final vem na proposta.' },
    indicadores: {
      economiaPrimeiroAno: dinheiro(indicadores.economiaPrimeiroAno),
      economiaMensalMedia: dinheiro(indicadores.economiaPrimeiroAno.div(12)),
      economiaTotal: dinheiro(indicadores.economiaTotal),
      vpl: dinheiro(indicadores.vpl),
      tir: indicadores.tir === null ? null : taxa(indicadores.tir),
      paybackSimplesAnos: anos(indicadores.paybackSimplesAnos),
      paybackDescontadoAnos: anos(indicadores.paybackDescontadoAnos),
    },
    // Os 12 primeiros meses, para o gráfico de consumo × geração e a comparação das faturas.
    primeiroAno: resultado.serieMensal.slice(0, 12).map((mes) => ({
      anoCivil: mes.anoCivil, mes: mes.mes, consumoKwh: energia(mes.consumo), geracaoKwh: energia(mes.geracao),
      faturaSemSolar: dinheiro(mes.faturaSemSolar), faturaComSolar: dinheiro(mes.faturaComSolar), economia: dinheiro(mes.economia),
    })),
    resumoAnual: resultado.resumoAnual.map((ano) => ({
      ano: ano.ano, geracaoKwh: energia(ano.geracao), economia: dinheiro(ano.economia),
      fluxoDeCaixa: dinheiro(ano.fluxoDeCaixa), fluxoAcumulado: dinheiro(ano.fluxoAcumulado),
    })),
    premissas: formatarPremissas(entrada, contexto),
    alertas: resultado.alertas,
  };
}

export type SimulacaoFormatada = ReturnType<typeof formatarSimulacao>;
