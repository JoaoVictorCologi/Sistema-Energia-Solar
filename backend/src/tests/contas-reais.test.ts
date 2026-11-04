// Reproduz contas de luz com o motor e compara com o valor cobrado (meta: erro abaixo de 5%).
// Cada conta é um arquivo JSON na pasta de casos, sem nome, CPF, endereço ou número da instalação.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { compensarMes } from '../motor/faturamento.ts';
import { cobrancaFioB, tarifaComImpostos } from '../motor/tarifa.ts';
import { fracao, kwh, reaisPorKwh } from '../motor/tipos.ts';

const PASTA = path.join(import.meta.dirname, 'contas-reais');
const ERRO_MAXIMO = new Decimal('0.05');
const CONTAS_REAIS_ESPERADAS = 3;

const texto = z.string().regex(/^\d+(\.\d+)?$/);
const esquemaConta = z.object({
  descricao: z.string(),
  real: z.boolean(),
  mesReferencia: z.string().regex(/^\d{4}-\d{2}$/),
  consumoMinimoKwh: texto,
  regime: z.enum(['GD_I', 'GD_II']),
  // Lidos da própria conta: consumo medido da rede, energia injetada e créditos do mês anterior.
  consumoDaRedeKwh: texto,
  injecaoKwh: texto,
  creditosAnterioresKwh: texto,
  tarifaSemImpostos: z.object({ te: texto, tusd: texto, fioB: texto }),
  percentualFioB: texto,
  tributos: z.object({ icms: texto, pis: texto, cofins: texto, icmsSobreFioB: z.boolean() }),
  cobradoSemIluminacaoPublica: texto,
});

type Conta = z.infer<typeof esquemaConta>;

const contas = readdirSync(PASTA)
  .filter((arquivo) => arquivo.endsWith('.json'))
  .map((arquivo) => ({ arquivo, conta: esquemaConta.parse(JSON.parse(readFileSync(path.join(PASTA, arquivo), 'utf8'))) }));

function calcularConta(conta: Conta): Decimal {
  const { te, tusd, fioB } = conta.tarifaSemImpostos;
  const tarifaDoMes = { te: reaisPorKwh(te), tusd: reaisPorKwh(tusd), fioB: reaisPorKwh(fioB), adicionalBandeira: reaisPorKwh(0) };
  const tributos = { icms: fracao(conta.tributos.icms), pis: fracao(conta.tributos.pis), cofins: fracao(conta.tributos.cofins), icmsSobreFioB: conta.tributos.icmsSobreFioB };
  const creditos = new Decimal(conta.creditosAnterioresKwh).gt(0) ? [{ mesDeOrigem: 0, energia: kwh(conta.creditosAnterioresKwh) }] : [];
  return compensarMes({
    mes: 1,
    consumoDaRede: kwh(conta.consumoDaRedeKwh),
    injecao: kwh(conta.injecaoKwh),
    consumoMinimo: kwh(conta.consumoMinimoKwh),
    tarifaCheia: tarifaComImpostos(tarifaDoMes, tributos),
    cobrancaFioB: cobrancaFioB(tarifaDoMes, tributos, fracao(conta.percentualFioB)),
    regime: conta.regime,
    validadeDosCreditosMeses: 60,
  }, creditos).faturaComSolar;
}

describe('contas de luz: calculado × cobrado', () => {
  it.each(contas)('$arquivo: erro abaixo de 5%', ({ conta }) => {
    const cobrado = new Decimal(conta.cobradoSemIluminacaoPublica);
    const erro = calcularConta(conta).minus(cobrado).abs().div(cobrado);
    expect(erro.lte(ERRO_MAXIMO)).toBe(true);
  });

  // Pendente até a conferência das contas reais, uma por teste.
  const reais = contas.filter(({ conta }) => conta.real).length;
  for (let numero = reais + 1; numero <= CONTAS_REAIS_ESPERADAS; numero++) {
    it.todo(`conta real ${numero} da distribuidora da demonstração`);
  }
});
