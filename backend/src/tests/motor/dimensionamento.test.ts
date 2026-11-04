import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { dimensionar } from '../../motor/dimensionamento.ts';
import { fracao, kwh } from '../../motor/tipos.ts';

const doze = <T>(valor: T): T[] => Array.from({ length: 12 }, () => valor);

// Exemplo resolvido: 400 kWh por mês, HSP 5,0 o ano todo, PR 0,78, módulo de 550 W.
const EXEMPLO = {
  consumoMensal: doze(kwh(400)),
  hspMensal: doze(new Decimal(5)),
  performanceRatio: fracao('0.78'),
  coberturaAlvo: fracao('1'),
  potenciaModuloW: new Decimal(550),
  inversoresKw: [new Decimal(3)],
};

describe('dimensionamento', () => {
  it('exemplo resolvido → 7 módulos, 3,85 kWp, inversor de 3 kW, razão 1,283', () => {
    const resultado = dimensionar(EXEMPLO);

    expect(resultado.kwpAlvo.toDecimalPlaces(3).toString()).toBe('3.372');
    expect(resultado.numeroModulos).toBe(7);
    expect(resultado.kwpInstalado.toString()).toBe('3.85');
    expect(resultado.inversorKw?.toString()).toBe('3');
    expect(resultado.razaoCcCa?.toDecimalPlaces(3).toString()).toBe('1.283');
    expect(resultado.alertas).toEqual([]);
  });

  it('escolhe o menor inversor com razão entre 1,15 e 1,35', () => {
    const resultado = dimensionar({ ...EXEMPLO, inversoresKw: [5, 2, 3, 4].map((kw) => new Decimal(kw)) });

    expect(resultado.inversorKw?.toString()).toBe('3');
  });

  it('sem inversor na faixa, usa o de razão mais próxima da faixa e avisa', () => {
    // 3,85 ÷ 2 = 1,925 (0,575 acima da faixa); 3,85 ÷ 5 = 0,77 (0,38 abaixo).
    const resultado = dimensionar({ ...EXEMPLO, inversoresKw: [new Decimal(2), new Decimal(5)] });

    expect(resultado.inversorKw?.toString()).toBe('5');
    expect(resultado.alertas.map((alerta) => alerta.codigo)).toEqual(['RAZAO_CC_CA_FORA_DA_FAIXA']);
  });

  it('razão acima de 1,40 também avisa a perda por ceifamento', () => {
    const resultado = dimensionar({ ...EXEMPLO, inversoresKw: [new Decimal(2)] });

    expect(resultado.razaoCcCa?.toString()).toBe('1.925');
    expect(resultado.alertas.map((alerta) => alerta.codigo)).toEqual(['RAZAO_CC_CA_FORA_DA_FAIXA', 'CEIFAMENTO']);
    expect(resultado.alertas[0].mensagem).toBe('Razão CC/CA de 1,93, fora da faixa de 1,15 a 1,35.');
  });

  it('sem inversores, não escolhe nenhum e avisa', () => {
    const resultado = dimensionar({ ...EXEMPLO, inversoresKw: [] });

    expect(resultado.inversorKw).toBeNull();
    expect(resultado.alertas.map((alerta) => alerta.codigo)).toEqual(['SEM_INVERSOR_COMPATIVEL']);
  });

  it('cobertura de 50% pede metade da potência', () => {
    const resultado = dimensionar({ ...EXEMPLO, coberturaAlvo: fracao('0.5') });

    expect(resultado.kwpAlvo.toDecimalPlaces(3).toString()).toBe('1.686');
    expect(resultado.numeroModulos).toBe(4);
  });

  it('área limita os módulos: fica no máximo e avisa', () => {
    const resultado = dimensionar({ ...EXEMPLO, numeroMaximoDeModulos: 4 });

    expect(resultado.numeroModulos).toBe(4);
    expect(resultado.kwpInstalado.toString()).toBe('2.2');
    expect(resultado.alertas.map((alerta) => alerta.codigo)).toContain('AREA_INSUFICIENTE');
  });

  it('área que comporta o necessário não muda nada', () => {
    const resultado = dimensionar({ ...EXEMPLO, numeroMaximoDeModulos: 20 });

    expect(resultado.numeroModulos).toBe(7);
    expect(resultado.alertas).toEqual([]);
  });

  it('quantidade definida na revisão do operador vale sobre o cálculo', () => {
    expect(dimensionar({ ...EXEMPLO, numeroFixoDeModulos: 9 }).numeroModulos).toBe(9);
  });
});
