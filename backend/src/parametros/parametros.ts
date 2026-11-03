// Premissas que não têm API (Lei 14.300, impostos, PR, custo de referência), versionadas no Git.
// O arquivo é validado ao carregar: um valor fora da faixa impede o backend de subir.
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import dados from './parametros.json' with { type: 'json' };

function decimal(minimo: string, maximo: string) {
  return z.string()
    .regex(/^\d+(\.\d+)?$/, 'use texto com ponto decimal, ex.: "0.78"')
    .transform((valor) => new Decimal(valor))
    .refine((valor) => valor.gte(minimo) && valor.lte(maximo), `precisa estar entre ${minimo} e ${maximo}`);
}

const fracao = decimal('0', '1');

const esquemaParametros = z.object({
  versao: z.string().min(1),
  uf: z.string().regex(/^[A-Z]{2}$/, 'sigla da UF, ex.: "SP"'),
  distribuidoraPadrao: z.string().min(1),
  fioBPercentualPorAno: z.record(z.string().regex(/^\d{4}$/), fracao),
  consumoMinimoKwh: z.object({
    monofasico: decimal('0', '1000'),
    bifasico: decimal('0', '1000'),
    trifasico: decimal('0', '1000'),
  }),
  impostos: z.object({
    // Faixas em ordem crescente; a última (ateKwh nulo) vale para qualquer consumo acima.
    icmsFaixas: z.array(z.object({ ateKwh: decimal('0', '100000').nullable(), aliquota: fracao })).min(1),
    pis: fracao,
    cofins: fracao,
  }),
  performanceRatio: decimal('0.70', '0.85'),
  degradacaoAnualPadrao: decimal('0.002', '0.01'),
  simultaneidade: z.object({ B1: decimal('0.10', '0.70'), B2: decimal('0.10', '0.70'), B3: decimal('0.10', '0.70') }),
  custoReferenciaPorKwp: decimal('0.01', '100000'),
  fontes: z.record(z.string(), z.string()),
}).refine(
  // Tributos "por dentro": a tarifa é dividida por (1 − soma), que precisa ficar longe de zero.
  ({ impostos }) => impostos.icmsFaixas.every(({ aliquota }) => aliquota.plus(impostos.pis).plus(impostos.cofins).lt('0.5')),
  { message: 'ICMS + PIS + COFINS precisa ser menor que 0.5', path: ['impostos'] },
).refine(
  ({ impostos }) => impostos.icmsFaixas.at(-1)?.ateKwh === null,
  { message: 'a última faixa de ICMS precisa ter ateKwh nulo', path: ['impostos', 'icmsFaixas'] },
);

export type Parametros = z.infer<typeof esquemaParametros>;

export function lerParametros(conteudo: unknown): Parametros {
  const resultado = esquemaParametros.safeParse(conteudo);
  if (resultado.success) return resultado.data;
  const problemas = resultado.error.issues.map((problema) => `- ${problema.path.join('.')}: ${problema.message}`);
  throw new Error(`parametros.json inválido:\n${problemas.join('\n')}`);
}

export const parametros: Parametros = lerParametros(dados);
