// Premissas que não têm API (Lei 14.300, PR, custo de referência), versionadas no Git. Impostos: tributos.ts.
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
  // Distribuidora das contas reais que calibram PR e simultaneidade; `calibrada` só depois de conferir as contas.
  calibracao: z.object({ calibrada: z.boolean(), cnpj: z.string().regex(/^\d{14}$/, 'CNPJ com 14 números'), sigla: z.string().min(1) }),
  fioBPercentualPorAno: z.record(z.string().regex(/^\d{4}$/), fracao),
  consumoMinimoKwh: z.object({
    monofasico: decimal('0', '1000'),
    bifasico: decimal('0', '1000'),
    trifasico: decimal('0', '1000'),
  }),
  performanceRatio: decimal('0.70', '0.85'),
  degradacaoAnualPadrao: decimal('0.002', '0.01'),
  simultaneidade: z.object({ B1: decimal('0.10', '0.70'), B2: decimal('0.10', '0.70'), B3: decimal('0.10', '0.70') }),
  custoReferenciaPorKwp: decimal('0.01', '100000'),
  coberturaAlvo: decimal('0.5', '1.2'),
  horizonteAnos: z.number().int().min(1).max(40),
  validadeDosCreditosMeses: z.number().int().min(1).max(120),
  moduloReferencia: z.object({ potenciaW: decimal('100', '800') }),
  inversoresReferenciaKw: z.array(decimal('0.5', '1000')).min(1),
  operacaoManutencaoAnual: decimal('0', '0.03'),
  trocaDoInversor: z.object({ ano: z.number().int().min(10).max(15), fracaoDoInvestimento: decimal('0', '0.5') }),
  proposta: z.object({ instalacaoPorKwp: decimal('0', '10000'), margem: decimal('0', '1'), validadeDias: z.number().int().min(1).max(90) }),
  fontes: z.record(z.string(), z.string()),
});

export type Parametros = z.infer<typeof esquemaParametros>;

export function lerParametros(conteudo: unknown): Parametros {
  const resultado = esquemaParametros.safeParse(conteudo);
  if (resultado.success) return resultado.data;
  const problemas = resultado.error.issues.map((problema) => `- ${problema.path.join('.')}: ${problema.message}`);
  throw new Error(`parametros.json inválido:\n${problemas.join('\n')}`);
}

export const parametros: Parametros = lerParametros(dados);
