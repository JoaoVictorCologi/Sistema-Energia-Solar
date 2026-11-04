// Premissas técnicas que não têm API (Lei 14.300, PR, telhado), versionadas no Git. Os impostos têm validação própria.
// Valores comerciais (margem, instalação, custo de referência) ficam no banco, editados no painel.
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
const fatorDeTelhado = decimal('0.3', '1');
const umaSimultaneidade = decimal('0.10', '0.70');
const simultaneidadePorPerfil = z.object({ padrao: umaSimultaneidade, noite: umaSimultaneidade, equilibrado: umaSimultaneidade, dia: umaSimultaneidade });

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
  simultaneidade: z.object({ B1: simultaneidadePorPerfil, B2: simultaneidadePorPerfil, B3: simultaneidadePorPerfil }),
  coberturaAlvo: decimal('0.5', '1.2'),
  horizonteAnos: z.number().int().min(1).max(40),
  validadeDosCreditosMeses: z.number().int().min(1).max(120),
  moduloReferencia: z.object({ potenciaW: decimal('100', '800') }),
  inversoresReferenciaKw: z.array(decimal('0.5', '1000')).min(1),
  operacaoManutencaoAnual: decimal('0', '0.03'),
  trocaDoInversor: z.object({ ano: z.number().int().min(10).max(15), fracaoDoInvestimento: decimal('0', '0.5') }),
  coberturaMaximaSobreConsumoAtual: decimal('1', '2'),
  telhado: z.object({
    areaPorModuloM2: decimal('1', '10'),
    horasDeSol: z.object({ diaTodo: fatorDeTelhado, de6a8: fatorDeTelhado, de4a6: fatorDeTelhado, menosDe4: fatorDeTelhado }),
    orientacao: z.object({
      norte: fatorDeTelhado, nordeste: fatorDeTelhado, noroeste: fatorDeTelhado, leste: fatorDeTelhado, oeste: fatorDeTelhado,
      sudeste: fatorDeTelhado, sudoeste: fatorDeTelhado, sul: fatorDeTelhado, plano: fatorDeTelhado,
    }),
    inclinacao: z.object({ plano: fatorDeTelhado, pouca: fatorDeTelhado, media: fatorDeTelhado, muita: fatorDeTelhado }),
  }),
  contaDeLuz: z.object({ aliquotaImplicitaMinima: fracao, aliquotaImplicitaMaxima: fracao, toleranciaDaTarifa: fracao }),
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
