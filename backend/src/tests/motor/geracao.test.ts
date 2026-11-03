import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { diasDoMes, geracaoMensal } from '../../motor/geracao.ts';
import { fracao, kwp } from '../../motor/tipos.ts';

describe('geração mensal', () => {
  const PR = fracao('0.78');
  const DEGRADACAO = fracao('0.005');

  it('exemplo resolvido → 450,45 kWh no ano 1', () => {
    expect(geracaoMensal(kwp('3.85'), new Decimal(5), 30, PR, DEGRADACAO, 1).toString()).toBe('450.45');
  });

  it('com 0,5% de degradação, 448,20 kWh no ano 2', () => {
    expect(geracaoMensal(kwp('3.85'), new Decimal(5), 30, PR, DEGRADACAO, 2).toDecimalPlaces(2).toString()).toBe('448.2');
  });

  it('é proporcional aos dias do mês', () => {
    const fevereiro = geracaoMensal(kwp('3.85'), new Decimal(5), 28, PR, DEGRADACAO, 1);
    const janeiro = geracaoMensal(kwp('3.85'), new Decimal(5), 31, PR, DEGRADACAO, 1);
    expect(janeiro.div(fevereiro).toString()).toBe(new Decimal(31).div(28).toString());
  });
});

describe('dias do mês', () => {
  it('segue o calendário, com fevereiro de 29 dias no ano bissexto', () => {
    expect([diasDoMes(2026, 1), diasDoMes(2026, 2), diasDoMes(2028, 2), diasDoMes(2026, 4)]).toEqual([31, 28, 29, 30]);
  });
});
