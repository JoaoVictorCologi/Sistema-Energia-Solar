// Junta as etapas: dimensiona uma vez e percorre os meses em ordem, porque os créditos de um mês
// mudam a fatura dos seguintes. Só no fim os meses viram anos e indicadores.
import { Decimal } from 'decimal.js';
import { dimensionar, type Dimensionamento } from './dimensionamento.ts';
import { calcularIndicadores, type Indicadores } from './financeiro.ts';
import { faturarMes, type LoteDeCredito, type RegimeGd, type ResultadoMes } from './faturamento.ts';
import { diasDoMes, geracaoMensal } from './geracao.ts';
import { cobrancaFioB, tarifaComImpostos, tarifaDoAno, type TarifaSemImpostos, type Tributos } from './tarifa.ts';
import { fracao, kwh, reais, type Alerta, type Fracao, type Kwh, type Reais } from './tipos.ts';

export interface PremissasDaSimulacao {
  performanceRatio: Fracao;
  simultaneidade: Fracao;
  coberturaAlvo: Fracao;
  // Custo de disponibilidade da ligação (30, 50 ou 100 kWh).
  consumoMinimo: Kwh;
  // Lei 14.300, art. 27, por ano civil. Depois do último ano da tabela vale o último; antes do primeiro, zero.
  percentualFioBPorAno: Record<number, Fracao>;
  validadeDosCreditosMeses: number;
  reajusteAnual: Fracao;
  taxaDesconto: Fracao;
  horizonteAnos: number;
  // Fração do investimento por ano, corrigida pelo reajuste.
  operacaoManutencaoAnual: Fracao;
  trocaDoInversor: { ano: number; custo: Reais } | null;
}

export interface EntradaSimulacao {
  // 12 valores, de janeiro a dezembro.
  consumoMensal: Kwh[];
  hspMensal: Decimal[];
  tarifa: TarifaSemImpostos;
  tributos: Tributos;
  modulo: { potenciaW: Decimal; degradacaoAnual: Fracao };
  inversoresKw: Decimal[];
  investimento: Reais;
  // Mês da conexão prevista (1 a 12).
  inicio: { ano: number; mes: number };
  regime: RegimeGd;
  premissas: PremissasDaSimulacao;
}

export interface MesSimulado extends ResultadoMes {
  // Ano da simulação (1 a 25); anoCivil e mes são do calendário.
  ano: number;
  anoCivil: number;
  mes: number;
  consumo: Kwh;
}

export interface AnoSimulado {
  ano: number;
  geracao: Kwh;
  economia: Reais;
  operacaoManutencao: Reais;
  trocaDoInversor: Reais;
  fluxoDeCaixa: Reais;
  fluxoAcumulado: Reais;
}

export interface ResultadoSimulacao {
  dimensionamento: Dimensionamento;
  serieMensal: MesSimulado[];
  resumoAnual: AnoSimulado[];
  indicadores: Indicadores & { economiaPrimeiroAno: Reais; economiaTotal: Reais };
  alertas: Alerta[];
}

// Arredondar os módulos para cima já sobra um pouco de energia; só avisa quando vence mais de 1% da geração.
const LIMITE_DE_CREDITOS_VENCIDOS = new Decimal('0.01');

export function percentualFioB(tabela: Record<number, Fracao>, anoCivil: number): Fracao {
  const anos = Object.keys(tabela).map(Number).sort((a, b) => a - b);
  const anoDaTabela = anos.filter((ano) => ano <= anoCivil).at(-1);
  return anoDaTabela === undefined ? fracao(0) : tabela[anoDaTabela];
}

function simularMeses(entrada: EntradaSimulacao, dimensionamento: Dimensionamento): MesSimulado[] {
  const { premissas } = entrada;
  const meses: MesSimulado[] = [];
  let creditos: LoteDeCredito[] = [];

  for (let indice = 0; indice < premissas.horizonteAnos * 12; indice++) {
    const ano = Math.floor(indice / 12) + 1;
    const mesesDesdeJaneiro = entrada.inicio.mes - 1 + indice;
    const anoCivil = entrada.inicio.ano + Math.floor(mesesDesdeJaneiro / 12);
    const mes = (mesesDesdeJaneiro % 12) + 1;
    const tarifa = tarifaDoAno(entrada.tarifa, premissas.reajusteAnual, ano);
    const consumo = entrada.consumoMensal[mes - 1];
    const geracao = geracaoMensal(dimensionamento.kwpInstalado, entrada.hspMensal[mes - 1], diasDoMes(anoCivil, mes),
      premissas.performanceRatio, entrada.modulo.degradacaoAnual, ano);

    const faturado = faturarMes({
      mes: indice, consumo, geracao, simultaneidade: premissas.simultaneidade, consumoMinimo: premissas.consumoMinimo,
      tarifaCheia: tarifaComImpostos(tarifa, entrada.tributos),
      cobrancaFioB: cobrancaFioB(tarifa, entrada.tributos, percentualFioB(premissas.percentualFioBPorAno, anoCivil)),
      regime: entrada.regime, validadeDosCreditosMeses: premissas.validadeDosCreditosMeses,
    }, creditos);
    creditos = faturado.creditos;
    meses.push({ ano, anoCivil, mes, consumo, ...faturado.resultado });
  }
  return meses;
}

function resumirAnos(meses: MesSimulado[], entrada: EntradaSimulacao): AnoSimulado[] {
  const { premissas, investimento } = entrada;
  const anos: AnoSimulado[] = [];
  let fluxoAcumulado: Decimal = investimento.neg();

  for (let ano = 1; ano <= premissas.horizonteAnos; ano++) {
    const doAno = meses.filter((mes) => mes.ano === ano);
    const correcao = premissas.reajusteAnual.plus(1).pow(ano - 1);
    const economia = reais(Decimal.sum(...doAno.map((mes) => mes.economia)));
    const operacaoManutencao = reais(investimento.times(premissas.operacaoManutencaoAnual).times(correcao));
    const trocaDoInversor = reais(premissas.trocaDoInversor?.ano === ano ? premissas.trocaDoInversor.custo.times(correcao) : 0);
    const fluxoDeCaixa = reais(economia.minus(operacaoManutencao).minus(trocaDoInversor));
    fluxoAcumulado = fluxoAcumulado.plus(fluxoDeCaixa);
    anos.push({
      ano, geracao: kwh(Decimal.sum(...doAno.map((mes) => mes.geracao))), economia, operacaoManutencao,
      trocaDoInversor, fluxoDeCaixa, fluxoAcumulado: reais(fluxoAcumulado),
    });
  }
  return anos;
}

function alertasDaSimulacao(entrada: EntradaSimulacao, meses: MesSimulado[], indicadores: Indicadores): Alerta[] {
  const alertas: Alerta[] = [];
  if (Decimal.sum(...entrada.consumoMensal).div(12).lt(entrada.premissas.consumoMinimo)) {
    alertas.push({ codigo: 'CONSUMO_ABAIXO_DO_MINIMO', mensagem: 'O consumo médio está abaixo do mínimo da ligação: a conta já é a mínima e o sistema dificilmente compensa.' });
  }
  const vencidos = Decimal.sum(...meses.map((mes) => mes.creditosVencidos));
  if (vencidos.gt(Decimal.sum(...meses.map((mes) => mes.geracao)).times(LIMITE_DE_CREDITOS_VENCIDOS))) {
    alertas.push({ codigo: 'CREDITOS_VENCIDOS', mensagem: 'Parte dos créditos vence sem uso: o sistema gera mais do que a casa consome.' });
  }
  if (indicadores.tir === null) alertas.push({ codigo: 'TIR_NAO_CALCULAVEL', mensagem: 'O investimento não se paga no horizonte simulado.' });
  return alertas;
}

export function simular(entrada: EntradaSimulacao): ResultadoSimulacao {
  const { premissas } = entrada;
  const dimensionamento = dimensionar({
    consumoMensal: entrada.consumoMensal, hspMensal: entrada.hspMensal, performanceRatio: premissas.performanceRatio,
    coberturaAlvo: premissas.coberturaAlvo, potenciaModuloW: entrada.modulo.potenciaW, inversoresKw: entrada.inversoresKw,
  });
  const serieMensal = simularMeses(entrada, dimensionamento);
  const resumoAnual = resumirAnos(serieMensal, entrada);
  const indicadores = calcularIndicadores([reais(entrada.investimento.neg()), ...resumoAnual.map((ano) => ano.fluxoDeCaixa)], premissas.taxaDesconto);
  return {
    dimensionamento,
    serieMensal,
    resumoAnual,
    indicadores: {
      ...indicadores,
      economiaPrimeiroAno: resumoAnual[0].economia,
      economiaTotal: reais(Decimal.sum(...resumoAnual.map((ano) => ano.economia))),
    },
    alertas: [...dimensionamento.alertas, ...alertasDaSimulacao(entrada, serieMensal, indicadores)],
  };
}
