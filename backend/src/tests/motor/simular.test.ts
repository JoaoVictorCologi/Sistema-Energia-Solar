import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { faturarMes, type EntradaMes } from '../../motor/faturamento.ts';
import { simular, type EntradaSimulacao } from '../../motor/simular.ts';
import { fracao, kwh, reais, reaisPorKwh } from '../../motor/tipos.ts';

const doze = <T>(valor: T): T[] => Array.from({ length: 12 }, () => valor);
const duas = (valor: Decimal) => valor.toDecimalPlaces(2).toString();

// Exemplo resolvido, começando em abril de 2026 (30 dias): o primeiro mês deve reproduzir a conta da especificação.
function entradaDoExemplo(alteracoes: Partial<EntradaSimulacao> = {}): EntradaSimulacao {
  return {
    consumoMensal: doze(kwh(400)),
    hspMensal: doze(new Decimal(5)),
    tarifa: { te: reaisPorKwh('0.30'), tusd: reaisPorKwh('0.45'), fioB: reaisPorKwh('0.20'), adicionalBandeira: reaisPorKwh(0) },
    tributos: { icms: fracao('0.18'), pis: fracao('0.01'), cofins: fracao('0.045'), icmsSobreFioB: true },
    modulo: { potenciaW: new Decimal(550), degradacaoAnual: fracao('0.005') },
    inversoresKw: [new Decimal(3)],
    investimento: reais(15400),
    inicio: { ano: 2026, mes: 4 },
    regime: 'GD_II',
    premissas: {
      performanceRatio: fracao('0.78'),
      simultaneidade: fracao('0.30'),
      coberturaAlvo: fracao('1'),
      consumoMinimo: kwh(30),
      percentualFioBPorAno: { 2026: fracao('0.60'), 2027: fracao('0.75'), 2028: fracao('0.90'), 2029: fracao('1') },
      validadeDosCreditosMeses: 60,
      reajusteAnual: fracao('0.0458'),
      taxaDesconto: fracao('0.1375'),
      horizonteAnos: 25,
      operacaoManutencaoAnual: fracao('0.005'),
      trocaDoInversor: { ano: 12, custo: reais(2300) },
    },
    ...alteracoes,
  };
}

describe('simular', () => {
  const resultado = simular(entradaDoExemplo());

  it('o primeiro mês reproduz o exemplo resolvido', () => {
    const [abril] = resultado.serieMensal;

    expect(resultado.dimensionamento.kwpInstalado.toString()).toBe('3.85');
    expect({ ano: abril.ano, anoCivil: abril.anoCivil, mes: abril.mes }).toEqual({ ano: 1, anoCivil: 2026, mes: 4 });
    expect(duas(abril.geracao)).toBe('450.45');
    expect(duas(abril.faturaSemSolar)).toBe('392.16');
    expect(duas(abril.faturaComSolar)).toBe('41.55');
    expect(duas(abril.economia)).toBe('350.61');
  });

  it('percorre 300 meses e resume 25 anos', () => {
    expect(resultado.serieMensal).toHaveLength(300);
    expect(resultado.resumoAnual).toHaveLength(25);
    expect(resultado.serieMensal.at(-1)).toMatchObject({ ano: 25, anoCivil: 2051, mes: 3 });
  });

  it('o fluxo de caixa desconta O&M e a troca do inversor no ano 12, corrigidos pelo reajuste', () => {
    const [ano1] = resultado.resumoAnual;
    const ano12 = resultado.resumoAnual[11];

    expect(duas(ano1.operacaoManutencao)).toBe('77');
    expect(ano1.trocaDoInversor.isZero()).toBe(true);
    expect(duas(ano12.trocaDoInversor)).toBe(duas(new Decimal(2300).times(new Decimal('1.0458').pow(11))));
    expect(duas(ano1.fluxoDeCaixa)).toBe(duas(ano1.economia.minus(77)));
    expect(duas(ano1.fluxoAcumulado)).toBe(duas(ano1.fluxoDeCaixa.minus(15400)));
  });

  it('usa o percentual de Fio B do ano civil; depois do último ano da tabela, vale o último', () => {
    const cobrancaPorKwh = (anoCivil: number, mes: number) => {
      const linha = resultado.serieMensal.find((item) => item.anoCivil === anoCivil && item.mes === mes)!;
      return linha.parcelaFioB.div(linha.energiaCompensada).div(new Decimal('1.0458').pow(linha.ano - 1));
    };

    expect(cobrancaPorKwh(2026, 12).toDecimalPlaces(6).toString()).toBe('0.156863');
    expect(cobrancaPorKwh(2027, 1).toDecimalPlaces(6).toString()).toBe('0.196078');
    expect(cobrancaPorKwh(2035, 6).toDecimalPlaces(6).toString()).toBe('0.261438');
  });

  it('traz os indicadores com a economia do primeiro ano e a total', () => {
    expect(resultado.indicadores.economiaPrimeiroAno.toString()).toBe(resultado.resumoAnual[0].economia.toString());
    expect(resultado.indicadores.tir).not.toBeNull();
    expect(resultado.indicadores.paybackSimplesAnos!.gt(0)).toBe(true);
    expect(resultado.indicadores.paybackSimplesAnos!.lt(resultado.indicadores.paybackDescontadoAnos!)).toBe(true);
  });

  it('avisa quando o consumo médio está abaixo do mínimo da ligação', () => {
    const pequeno = simular(entradaDoExemplo({ consumoMensal: doze(kwh(25)) }));
    expect(pequeno.alertas.map((alerta) => alerta.codigo)).toContain('CONSUMO_ABAIXO_DO_MINIMO');
  });

  it('avisa créditos vencidos quando o sistema gera muito mais que o consumo', () => {
    const superdimensionado = simular(entradaDoExemplo({ premissas: { ...entradaDoExemplo().premissas, coberturaAlvo: fracao('2') } }));
    expect(superdimensionado.alertas.map((alerta) => alerta.codigo)).toContain('CREDITOS_VENCIDOS');
  });

  it('é determinístico e roda os 300 meses em menos de 50 ms', () => {
    simular(entradaDoExemplo());
    const inicio = performance.now();
    const outro = simular(entradaDoExemplo());
    const duracao = performance.now() - inicio;

    expect(outro).toEqual(resultado);
    expect(duracao).toBeLessThan(50);
  });
});

// Propriedades da especificação, conferidas numa grade de entradas.
describe('propriedades do faturamento', () => {
  const MES: EntradaMes = {
    mes: 0, consumo: kwh(400), geracao: kwh(450), simultaneidade: fracao('0.30'), consumoMinimo: kwh(30),
    tarifaCheia: reaisPorKwh('0.98'), cobrancaFioB: reaisPorKwh('0.157'), regime: 'GD_II', validadeDosCreditosMeses: 60,
  };
  const CONSUMOS = [0, 10, 29, 30, 31, 100, 250, 400, 800, 2000];
  const GERACOES = [0, 15, 100, 300, 450, 1000, 3000];

  it('com geração zero, a fatura com solar é igual à sem solar', () => {
    for (const consumo of CONSUMOS) {
      const { resultado } = faturarMes({ ...MES, consumo: kwh(consumo), geracao: kwh(0) }, []);
      expect(resultado.faturaComSolar.toString()).toBe(resultado.faturaSemSolar.toString());
    }
  });

  it('a economia nunca passa da fatura sem solar, e os créditos nunca ficam negativos', () => {
    for (const regime of ['GD_I', 'GD_II'] as const) {
      for (const consumo of CONSUMOS) {
        for (const geracao of GERACOES) {
          const { resultado } = faturarMes({ ...MES, regime, consumo: kwh(consumo), geracao: kwh(geracao) }, [{ mesDeOrigem: 0, energia: kwh(50) }]);
          expect(resultado.economia.lte(resultado.faturaSemSolar)).toBe(true);
          expect(resultado.creditosNoFimDoMes.gte(0)).toBe(true);
          expect(resultado.faturaComSolar.gte(0)).toBe(true);
        }
      }
    }
  });

  // Fora da faixa em que o consumo da rede cruza o mínimo: ali a própria regra da GD II muda de forma
  // (abaixo do mínimo, cobra o mínimo e não compensa), e a fatura pode cair com mais consumo ou mais geração.
  it('com consumo da rede acima do mínimo, mais consumo nunca reduz a fatura', () => {
    for (const geracao of [100, 450, 1000]) {
      // Autoconsumo de até 300 kWh (30% de 1.000): com consumo a partir de 400, a rede fica acima de 30 kWh.
      const faturas = [400, 600, 800, 2000].map((consumo) => faturarMes({ ...MES, consumo: kwh(consumo), geracao: kwh(geracao) }, []).resultado.faturaComSolar);
      faturas.slice(1).forEach((fatura, indice) => expect(fatura.gte(faturas[indice])).toBe(true));
    }
  });

  it('com consumo da rede acima do mínimo, mais geração nunca reduz a economia', () => {
    const economias = [0, 100, 300, 450, 600].map((geracao) => faturarMes({ ...MES, consumo: kwh(800), geracao: kwh(geracao) }, []).resultado.economia);
    economias.slice(1).forEach((economia, indice) => expect(economia.gte(economias[indice])).toBe(true));
  });

  it('na GD II, a fatura com 100% de Fio B nunca é menor que com 60%', () => {
    for (const consumo of CONSUMOS) {
      for (const geracao of GERACOES) {
        const com60 = faturarMes({ ...MES, consumo: kwh(consumo), geracao: kwh(geracao), cobrancaFioB: reaisPorKwh('0.157') }, []);
        const com100 = faturarMes({ ...MES, consumo: kwh(consumo), geracao: kwh(geracao), cobrancaFioB: reaisPorKwh('0.2616') }, []);
        expect(com100.resultado.faturaComSolar.gte(com60.resultado.faturaComSolar)).toBe(true);
      }
    }
  });
});
