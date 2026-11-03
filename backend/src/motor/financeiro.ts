// Seção 7 da especificação: VPL, TIR e payback. O fluxo começa no ano 0 (investimento, negativo).
import { Decimal } from 'decimal.js';
import { fracao, reais, type Fracao, type Reais } from './tipos.ts';

export interface Indicadores {
  vpl: Reais;
  // Nulo quando não calculável (o fluxo não troca de sinal ou nunca se paga).
  tir: Fracao | null;
  paybackSimplesAnos: Decimal | null;
  paybackDescontadoAnos: Decimal | null;
}

// Bisseção entre −99% e 100% ao ano, até a diferença ficar abaixo de 1e-10.
const TIR_MINIMA = new Decimal('-0.99');
const TIR_MAXIMA = new Decimal('1');
const PRECISAO_DA_TIR = new Decimal('1e-10');

function descontar(fluxo: Decimal[], taxa: Decimal): Decimal[] {
  const base = taxa.plus(1);
  return fluxo.map((valor, ano) => valor.div(base.pow(ano)));
}

export function valorPresenteLiquido(fluxo: Reais[], taxa: Fracao): Reais {
  return reais(Decimal.sum(...descontar(fluxo, taxa)));
}

export function taxaInternaDeRetorno(fluxo: Reais[]): Fracao | null {
  let baixa = TIR_MINIMA;
  let alta = TIR_MAXIMA;
  const vplNaBaixa = valorPresenteLiquido(fluxo, fracao(baixa));
  if (vplNaBaixa.isZero()) return fracao(baixa);
  if (vplNaBaixa.isPositive() === valorPresenteLiquido(fluxo, fracao(alta)).isPositive()) return null;

  while (alta.minus(baixa).gt(PRECISAO_DA_TIR)) {
    const meio = baixa.plus(alta).div(2);
    const vplNoMeio = valorPresenteLiquido(fluxo, fracao(meio));
    if (vplNoMeio.isPositive() === vplNaBaixa.isPositive()) baixa = meio;
    else alta = meio;
  }
  return fracao(baixa.plus(alta).div(2));
}

// Primeiro ano em que o acumulado deixa de ser negativo, interpolando dentro do ano.
export function payback(fluxo: Decimal[]): Decimal | null {
  let acumulado = fluxo[0];
  if (acumulado.gte(0)) return new Decimal(0);
  for (let ano = 1; ano < fluxo.length; ano++) {
    const anterior = acumulado;
    acumulado = acumulado.plus(fluxo[ano]);
    if (acumulado.gte(0)) return new Decimal(ano - 1).plus(anterior.neg().div(fluxo[ano]));
  }
  return null;
}

export function calcularIndicadores(fluxo: Reais[], taxaDesconto: Fracao): Indicadores {
  return {
    vpl: valorPresenteLiquido(fluxo, taxaDesconto),
    tir: taxaInternaDeRetorno(fluxo),
    paybackSimplesAnos: payback(fluxo),
    paybackDescontadoAnos: payback(descontar(fluxo, taxaDesconto)),
  };
}
