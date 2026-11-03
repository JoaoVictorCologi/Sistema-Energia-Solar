import { describe, expect, it } from 'vitest';
import { calcularIndicadores, payback, taxaInternaDeRetorno, valorPresenteLiquido } from '../../motor/financeiro.ts';
import { fracao, reais } from '../../motor/tipos.ts';

const fluxo = (...valores: number[]) => valores.map((valor) => reais(valor));

describe('indicadores financeiros', () => {
  const EXEMPLO = fluxo(-1000, 500, 500, 500);

  it('[−1000, 500, 500, 500] a 10% → VPL 243,43', () => {
    expect(valorPresenteLiquido(EXEMPLO, fracao('0.10')).toDecimalPlaces(2).toString()).toBe('243.43');
  });

  it('TIR de 23,38%, que zera o VPL', () => {
    const tir = taxaInternaDeRetorno(EXEMPLO);
    expect(tir?.toDecimalPlaces(4).toString()).toBe('0.2338');
    expect(valorPresenteLiquido(EXEMPLO, tir!).abs().lt('0.000001')).toBe(true);
  });

  it('payback simples de 2,0 anos', () => {
    expect(payback(EXEMPLO)?.toString()).toBe('2');
  });

  it('payback interpola dentro do ano', () => {
    expect(payback(fluxo(-1000, 400, 400, 400))?.toDecimalPlaces(2).toString()).toBe('2.5');
  });

  it('payback descontado é maior que o simples', () => {
    const resultado = calcularIndicadores(EXEMPLO, fracao('0.10'));
    expect(resultado.paybackDescontadoAnos?.toDecimalPlaces(2).toString()).toBe('2.35');
    expect(resultado.paybackDescontadoAnos!.gt(resultado.paybackSimplesAnos!)).toBe(true);
  });

  it('sem troca de sinal, TIR e payback não são calculáveis', () => {
    const resultado = calcularIndicadores(fluxo(-1000, -10, -10), fracao('0.10'));
    expect(resultado.tir).toBeNull();
    expect(resultado.paybackSimplesAnos).toBeNull();
    expect(resultado.paybackDescontadoAnos).toBeNull();
  });
});
