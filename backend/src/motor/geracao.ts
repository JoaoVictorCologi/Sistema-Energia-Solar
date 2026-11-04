// Geração mensal do sistema, com a degradação dos módulos.
import type { Decimal } from 'decimal.js';
import { kwh, type Fracao, type Kwh, type Kwp } from './tipos.ts';

// Calendário real: a geração é proporcional ao número de dias (fevereiro com 28 ou 29).
export function diasDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

// E = kWp × HSP × dias × PR × (1 − degradação)^(ano − 1).
export function geracaoMensal(potencia: Kwp, hsp: Decimal, dias: number, performanceRatio: Fracao, degradacaoAnual: Fracao, anoDaSimulacao: number): Kwh {
  const perdaPelaIdade = degradacaoAnual.neg().plus(1).pow(anoDaSimulacao - 1);
  return kwh(potencia.times(hsp).times(dias).times(performanceRatio).times(perdaPelaIdade));
}
