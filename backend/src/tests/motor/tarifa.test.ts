import { describe, expect, it } from 'vitest';
import { cobrancaFioB, tarifaComImpostos, tarifaDoAno } from '../../motor/tarifa.ts';
import { fracao, reaisPorKwh } from '../../motor/tipos.ts';

// Exemplo resolvido: tarifas e impostos ilustrativos.
const TARIFA = { te: reaisPorKwh('0.30'), tusd: reaisPorKwh('0.45'), fioB: reaisPorKwh('0.20'), adicionalBandeira: reaisPorKwh('0') };
const TRIBUTOS = { icms: fracao('0.18'), pis: fracao('0.01'), cofins: fracao('0.045'), icmsSobreFioB: true };

describe('tarifa com impostos', () => {
  it('divide pela soma dos tributos (por dentro): 0,75 com 23,5% → 0,980392', () => {
    expect(tarifaComImpostos(TARIFA, TRIBUTOS).toDecimalPlaces(6).toString()).toBe('0.980392');
  });

  it('soma o adicional da bandeira antes dos impostos', () => {
    const comBandeira = { ...TARIFA, adicionalBandeira: reaisPorKwh('0.0765') };
    expect(tarifaComImpostos(comBandeira, TRIBUTOS).toDecimalPlaces(6).toString()).toBe('1.080392');
  });
});

describe('cobrança de Fio B por kWh compensado', () => {
  it('Fio B 0,20 a 60%, com ICMS → 0,156863', () => {
    expect(cobrancaFioB(TARIFA, TRIBUTOS, fracao('0.60')).toDecimalPlaces(6).toString()).toBe('0.156863');
  });

  it('sem ICMS sobre a energia compensada (divisor 0,945) → 0,126984', () => {
    expect(cobrancaFioB(TARIFA, { ...TRIBUTOS, icmsSobreFioB: false }, fracao('0.60')).toDecimalPlaces(6).toString()).toBe('0.126984');
  });

  it('é zero quando o percentual do ano é zero', () => {
    expect(cobrancaFioB(TARIFA, TRIBUTOS, fracao('0')).isZero()).toBe(true);
  });
});

describe('tarifa do ano', () => {
  it('ano 1 é a tarifa de hoje', () => {
    expect(tarifaDoAno(TARIFA, fracao('0.05'), 1).te.toString()).toBe('0.3');
  });

  it('reajusta todas as parcelas por (1 + r)^(ano − 1)', () => {
    const ano3 = tarifaDoAno(TARIFA, fracao('0.05'), 3);
    expect([ano3.te, ano3.tusd, ano3.fioB].map(String)).toEqual(['0.33075', '0.496125', '0.2205']);
  });
});
