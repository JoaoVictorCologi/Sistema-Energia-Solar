import { describe, expect, it } from 'vitest';
import { compensarMes, faturarMes, type EntradaMes, type LoteDeCredito } from '../../motor/faturamento.ts';
import { fracao, kwh, reaisPorKwh } from '../../motor/tipos.ts';

// Exemplo resolvido: tarifa cheia 0,980392… e cobrança de Fio B 0,156862… por kWh (0,75 e 0,6 × 0,20 ÷ 0,765).
const EXEMPLO: EntradaMes = {
  mes: 0,
  consumo: kwh(400),
  geracao: kwh('450.45'),
  simultaneidade: fracao('0.30'),
  consumoMinimo: kwh(30),
  tarifaCheia: reaisPorKwh(0.75 / 0.765),
  cobrancaFioB: reaisPorKwh((0.6 * 0.2) / 0.765),
  regime: 'GD_II',
  validadeDosCreditosMeses: 60,
};

const duas = (valor: { toDecimalPlaces(casas: number): { toString(): string } }) => valor.toDecimalPlaces(2).toString();
const totalDe = (lotes: LoteDeCredito[]) => lotes.reduce((soma, lote) => soma + lote.energia.toNumber(), 0);

describe('faturamento do mês — GD II (Lei 14.300)', () => {
  it('exemplo resolvido → compensa 264,87 kWh, crédito de 50,45 kWh, fatura de 41,55', () => {
    const { resultado, creditos } = faturarMes(EXEMPLO, []);

    expect(duas(resultado.autoconsumo)).toBe('135.14');
    expect(duas(resultado.injecao)).toBe('315.32');
    expect(duas(resultado.consumoDaRede)).toBe('264.87');
    expect(duas(resultado.energiaCompensada)).toBe('264.87');
    expect(duas(resultado.creditosNoFimDoMes)).toBe('50.45');
    expect(creditos).toHaveLength(1);
    expect(duas(resultado.faturaSemSolar)).toBe('392.16');
    expect(duas(resultado.faturaComSolar)).toBe('41.55');
    expect(duas(resultado.parcelaFioB)).toBe('41.55');
    expect(duas(resultado.economia)).toBe('350.61');
  });

  it('consumo da rede abaixo do mínimo: cobra 30 kWh pela tarifa cheia e toda a injeção vira crédito', () => {
    // Autoconsumo 30% × 60 = 18; consumo da rede 40 − 18 = 22 (abaixo de 30); injeção 60 − 18 = 42.
    const { resultado } = faturarMes({ ...EXEMPLO, consumo: kwh(40), geracao: kwh(60) }, []);

    expect(duas(resultado.consumoDaRede)).toBe('22');
    expect(resultado.energiaCompensada.isZero()).toBe(true);
    expect(duas(resultado.faturaComSolar)).toBe(duas(EXEMPLO.tarifaCheia.times(30)));
    expect(resultado.parcelaFioB.isZero()).toBe(true);
    expect(duas(resultado.creditosNoFimDoMes)).toBe('42');
  });
});

describe('faturamento do mês — GD I', () => {
  it('exemplo resolvido → compensa 234,87 kWh (para no mínimo), sem Fio B, fatura de 29,41', () => {
    const { resultado } = faturarMes({ ...EXEMPLO, regime: 'GD_I' }, []);

    expect(duas(resultado.energiaCompensada)).toBe('234.87');
    expect(resultado.parcelaFioB.isZero()).toBe(true);
    expect(duas(resultado.faturaComSolar)).toBe('29.41');
  });
});

describe('créditos de energia', () => {
  const SEM_GERACAO = { ...EXEMPLO, geracao: kwh(0) };

  it('lote com 61 meses é descartado e contado como vencido; com 60 ainda vale', () => {
    const lotes: LoteDeCredito[] = [{ mesDeOrigem: 0, energia: kwh(100) }, { mesDeOrigem: 1, energia: kwh(50) }];

    const { resultado } = faturarMes({ ...SEM_GERACAO, mes: 61 }, lotes);

    expect(resultado.creditosVencidos.toString()).toBe('100');
    expect(resultado.energiaCompensada.toString()).toBe('50');
  });

  it('usa a injeção do mês primeiro e depois o lote mais antigo', () => {
    const lotes: LoteDeCredito[] = [{ mesDeOrigem: 5, energia: kwh(200) }, { mesDeOrigem: 3, energia: kwh(100) }];

    const resultado = compensarMes({
      mes: 10, consumoDaRede: kwh(250), injecao: kwh(100), consumoMinimo: kwh(30), tarifaCheia: EXEMPLO.tarifaCheia,
      cobrancaFioB: EXEMPLO.cobrancaFioB, regime: 'GD_II', validadeDosCreditosMeses: 60,
    }, lotes);

    expect(resultado.energiaCompensada.toString()).toBe('250');
    expect(resultado.creditos.map((lote) => [lote.mesDeOrigem, lote.energia.toNumber()])).toEqual([[5, 150]]);
  });

  it('a sobra da injeção vira um lote novo com o mês de origem', () => {
    const { creditos } = faturarMes({ ...EXEMPLO, mes: 7 }, []);

    expect(creditos.map((lote) => lote.mesDeOrigem)).toEqual([7]);
    expect(totalDe(creditos)).toBeCloseTo(50.45, 2);
  });
});
