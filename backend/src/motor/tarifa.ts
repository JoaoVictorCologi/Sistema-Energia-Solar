// Seção 1 da especificação: tarifa com impostos e cobrança de Fio B.
import { Decimal } from 'decimal.js';
import { reaisPorKwh, type Fracao, type ReaisPorKwh } from './tipos.ts';

// Reais por kWh, sem impostos.
export interface TarifaSemImpostos {
  te: ReaisPorKwh;
  tusd: ReaisPorKwh;
  fioB: ReaisPorKwh;
  // Zero na bandeira verde.
  adicionalBandeira: ReaisPorKwh;
}

export interface Tributos {
  icms: Fracao;
  pis: Fracao;
  cofins: Fracao;
  // Falso quando a UF isenta de ICMS a energia compensada (Convênio ICMS 16/2015).
  icmsSobreFioB: boolean;
}

// Reajuste anual composto: o ano 1 é a tarifa de hoje.
export function tarifaDoAno(tarifa: TarifaSemImpostos, reajusteAnual: Fracao, anoDaSimulacao: number): TarifaSemImpostos {
  const fator = new Decimal(1).plus(reajusteAnual).pow(anoDaSimulacao - 1);
  return {
    te: reaisPorKwh(tarifa.te.times(fator)),
    tusd: reaisPorKwh(tarifa.tusd.times(fator)),
    fioB: reaisPorKwh(tarifa.fioB.times(fator)),
    adicionalBandeira: reaisPorKwh(tarifa.adicionalBandeira.times(fator)),
  };
}

// Tributos "por dentro": a tarifa é dividida por (1 − soma das alíquotas), não multiplicada.
export function tarifaComImpostos(tarifa: TarifaSemImpostos, tributos: Tributos): ReaisPorKwh {
  const divisor = new Decimal(1).minus(tributos.icms).minus(tributos.pis).minus(tributos.cofins);
  return reaisPorKwh(tarifa.te.plus(tarifa.tusd).plus(tarifa.adicionalBandeira).div(divisor));
}

// Lei 14.300, art. 27: na GD II, cada kWh compensado paga o percentual do Fio B do ano civil.
export function cobrancaFioB(tarifa: TarifaSemImpostos, tributos: Tributos, percentualDoAno: Fracao): ReaisPorKwh {
  const icms = tributos.icmsSobreFioB ? tributos.icms : new Decimal(0);
  const divisor = new Decimal(1).minus(icms).minus(tributos.pis).minus(tributos.cofins);
  return reaisPorKwh(percentualDoAno.times(tarifa.fioB).div(divisor));
}
