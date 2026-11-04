// Tributos da conta de luz por UF: o ICMS depende do estado do cliente, não da distribuidora.
// Validado ao carregar, como as premissas técnicas: UF faltando ou alíquota fora da faixa impede o backend de subir.
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import dados from './tributos-por-uf.json' with { type: 'json' };

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'] as const;

const fracao = z.string().regex(/^\d+(\.\d+)?$/, 'use texto com ponto decimal, ex.: "0.18"').transform((valor) => new Decimal(valor))
  .refine((valor) => valor.gte(0) && valor.lte(1), 'precisa estar entre 0 e 1');
const kwh = z.string().regex(/^\d+$/).transform((valor) => new Decimal(valor));

const esquemaUf = z.object({
  // Faixas em ordem crescente; a última (ateKwh nulo) vale para qualquer consumo acima.
  icmsFaixas: z.array(z.object({ ateKwh: kwh.nullable(), aliquota: fracao })).min(1)
    .refine((faixas) => faixas.at(-1)?.ateKwh === null, 'a última faixa precisa ter ateKwh nulo'),
  icmsSobreFioB: z.boolean(),
  fonte: z.string().min(1),
});

const esquemaTributos = z.object({
  versao: z.string().min(1),
  pisCofins: z.object({ pis: fracao, cofins: fracao, fonte: z.string() }),
  fonteGeral: z.string(),
  ufs: z.object(Object.fromEntries(UFS.map((uf) => [uf, esquemaUf])) as Record<(typeof UFS)[number], typeof esquemaUf>),
}).refine(
  // Tributos "por dentro": a tarifa é dividida por (1 − soma), que precisa ficar longe de zero.
  ({ pisCofins, ufs }) => Object.values(ufs).every((uf) => uf.icmsFaixas.every(({ aliquota }) => aliquota.plus(pisCofins.pis).plus(pisCofins.cofins).lt('0.5'))),
  { message: 'ICMS + PIS + COFINS precisa ser menor que 0.5', path: ['ufs'] },
);

export type Tributos = z.infer<typeof esquemaTributos>;
export type Uf = (typeof UFS)[number];

export function lerTributos(conteudo: unknown): Tributos {
  const resultado = esquemaTributos.safeParse(conteudo);
  if (resultado.success) return resultado.data;
  const problemas = resultado.error.issues.map((problema) => `- ${problema.path.join('.')}: ${problema.message}`);
  throw new Error(`tributos-por-uf.json inválido:\n${problemas.join('\n')}`);
}

export const tributos: Tributos = lerTributos(dados);

// Vale a primeira faixa que comporta o consumo médio (SP: 12% até 200 kWh, 18% acima).
export function tributosDaUf(uf: string, consumoMedio: Decimal): { icms: Decimal; pis: Decimal; cofins: Decimal; icmsSobreFioB: boolean } {
  const daUf = tributos.ufs[uf as Uf];
  if (!daUf) throw new Error(`UF sem tributos cadastrados: ${uf}`);
  const faixa = daUf.icmsFaixas.find(({ ateKwh }) => ateKwh === null || consumoMedio.lte(ateKwh))!;
  return { icms: faixa.aliquota, pis: tributos.pisCofins.pis, cofins: tributos.pisCofins.cofins, icmsSobreFioB: daUf.icmsSobreFioB };
}
