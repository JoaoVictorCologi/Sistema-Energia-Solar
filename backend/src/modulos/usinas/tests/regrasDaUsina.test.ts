// Regras puras do módulo: regime, vencimentos e conferências, sem banco nem API.
import { describe, expect, it } from 'vitest';
import { calcularRegime, calcularVencimento, conferirDatasDaUsina, conferirGarantiaDeDesempenho, conferirVencimentosDasGarantias } from '../services/regrasDaUsina.ts';

// O limite da Lei 14.300: 07/01/2023 é o último dia do GD I.
describe('calcularRegime', () => {
  it.each([
    ['2022-12-31', 'GD_I'],
    ['2023-01-07', 'GD_I'],
    ['2023-01-08', 'GD_II'],
    ['2024-06-01', 'GD_II'],
  ])('protocolo em %s → %s', (data, regime) => {
    expect(calcularRegime(data)).toBe(regime);
  });
});

// Fim de mês, anos bissextos e virada de ano, sem depender de Date.
describe('calcularVencimento', () => {
  it.each([
    ['2023-03-15', 144, '2035-03-15'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2024-02-29', 12, '2025-02-28'],
    ['2023-01-31', 1, '2023-02-28'],
    ['2023-12-31', 3, '2024-03-31'],
    ['2024-11-30', 3, '2025-02-28'],
    ['2023-11-15', 2, '2024-01-15'],
    ['2023-12-15', 12, '2024-12-15'],
    // 1900 não é bissexto (divisível por 100); 2000 é (divisível por 400).
    ['1899-01-31', 13, '1900-02-28'],
    ['1999-01-31', 13, '2000-02-29'],
    // Anos abaixo de 100 não viram 19xx, como aconteceria com Date.UTC.
    ['0050-06-15', 12, '0051-06-15'],
  ])('%s + %i meses → %s', (data, meses, vencimento) => {
    expect(calcularVencimento(data, meses)).toBe(vencimento);
  });
});

// A conexão pode ser no mesmo dia do protocolo, nunca antes.
describe('conferirDatasDaUsina', () => {
  it('recusa conexão anterior ao protocolo e aceita o mesmo dia', () => {
    expect(conferirDatasDaUsina('2024-05-10', '2024-05-09')).toHaveProperty('dataConexao');
    expect(conferirDatasDaUsina('2024-05-10', '2024-05-10')).toEqual({});
    expect(conferirDatasDaUsina('2024-05-10', '2024-05-11')).toEqual({});
  });
});

// null e undefined contam como garantia não informada.
describe('conferirGarantiaDeDesempenho', () => {
  it.each([[undefined], [null]])('módulo sem garantia (%s) é recusado', (garantia) => {
    expect(conferirGarantiaDeDesempenho('modulo', garantia)).toHaveProperty('garantiaDesempenhoAnos');
  });

  it('inversor com garantia é recusado', () => {
    expect(conferirGarantiaDeDesempenho('inversor', 25)).toHaveProperty('garantiaDesempenhoAnos');
  });

  it('módulo com garantia e inversor sem garantia são aceitos', () => {
    expect(conferirGarantiaDeDesempenho('modulo', 25)).toEqual({});
    expect(conferirGarantiaDeDesempenho('inversor', null)).toEqual({});
    expect(conferirGarantiaDeDesempenho('inversor', undefined)).toEqual({});
  });
});

// O teto é o ano 9999 do formato de data, conferido em cada garantia separadamente.
describe('conferirVencimentosDasGarantias', () => {
  const MENSAGEM = 'O vencimento desta garantia passa do ano 9999. Confira o valor.';

  it('9999-11-30 + 1 mês é aceito: o vencimento ainda cabe em AAAA-MM-DD', () => {
    expect(calcularVencimento('9999-11-30', 1)).toBe('9999-12-30');
    expect(conferirVencimentosDasGarantias('9999-11-30', 1, null)).toEqual({});
  });

  it('9999-12-01 + 1 mês é recusado', () => {
    expect(conferirVencimentosDasGarantias('9999-12-01', 1, null)).toEqual({ garantiaProdutoMeses: MENSAGEM });
  });

  it('2023-03-15 + 96000 meses é recusado', () => {
    expect(conferirVencimentosDasGarantias('2023-03-15', 96_000, null)).toEqual({ garantiaProdutoMeses: MENSAGEM });
  });

  it('2147483647 meses é recusado', () => {
    expect(conferirVencimentosDasGarantias('2023-03-15', 2_147_483_647, null)).toEqual({ garantiaProdutoMeses: MENSAGEM });
  });

  it('2147483647 anos é recusado só na garantia de desempenho', () => {
    expect(conferirVencimentosDasGarantias('2023-03-15', 144, 2_147_483_647)).toEqual({ garantiaDesempenhoAnos: MENSAGEM });
  });

  it('a garantia de desempenho conta em anos: 8999-12-15 + 1000 anos cabe, + 1001 anos não', () => {
    expect(conferirVencimentosDasGarantias('8999-12-15', 144, 1000)).toEqual({});
    expect(conferirVencimentosDasGarantias('8999-12-15', 144, 1001)).toEqual({ garantiaDesempenhoAnos: MENSAGEM });
  });

  it('recusa as duas garantias juntas', () => {
    expect(conferirVencimentosDasGarantias('9999-12-01', 1, 1)).toEqual({ garantiaProdutoMeses: MENSAGEM, garantiaDesempenhoAnos: MENSAGEM });
  });

  it.each([[null], [undefined]])('desempenho %s não gera erro', (garantia) => {
    expect(conferirVencimentosDasGarantias('2023-03-15', 144, garantia)).toEqual({});
    expect(conferirVencimentosDasGarantias('9999-12-01', 1, garantia)).toEqual({ garantiaProdutoMeses: MENSAGEM });
  });
});
