// Configuração comercial e formas de pagamento, editadas pela gestão no painel.
import type { Request, Response } from 'express';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { usuarioDaSessao } from '../middlewares/autenticar.ts';
import { lerEntrada } from '../middlewares/validar.ts';
import { alterarConfiguracao, alterarForma, cadastrarForma, consultarConfiguracao, consultarFormas } from '../services/configuracoesService.ts';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const decimal = (minimo: number, maximo: number) => z.number().min(minimo).max(maximo).transform((valor) => new Decimal(String(valor)));

// Frações: 0.20 = 20%.
export const esquemaConfiguracao = z.object({
  margem: decimal(0, 1).optional(),
  instalacaoPorKwp: decimal(0, 100_000).optional(),
  custoReferenciaPorKwp: decimal(1, 100_000).optional(),
  validadeDias: z.number().int().min(1).max(90).optional(),
  limiteDesconto: decimal(0, 1).optional(),
}).refine((mudanca) => Object.keys(mudanca).length > 0, { message: 'Informe o que mudar.', path: ['corpo'] });

const camposDaForma = {
  nome: z.string().trim().min(2, 'Informe o nome.').max(80, 'Nome longo demais.'),
  // Ao mês: 0.015 = 1,5%; 0 = sem juros; nula enquanto não definida (a forma não pode ficar ativa).
  taxaMensal: decimal(0, 0.2).nullable(),
  parcelasMinimas: z.number().int().min(1).max(600),
  parcelasMaximas: z.number().int().min(1).max(600),
  entradaMinima: decimal(0, 0.9),
  carenciaMaximaDias: z.number().int().min(0).max(365),
  descontoAvista: decimal(0, 0.5),
  ativa: z.boolean(),
};

export const esquemaNovaForma = z.object({
  tipo: z.enum(['avista', 'parcelado', 'financiado']),
  nome: camposDaForma.nome,
  taxaMensal: camposDaForma.taxaMensal.default(null),
  parcelasMinimas: camposDaForma.parcelasMinimas.default(1),
  parcelasMaximas: camposDaForma.parcelasMaximas.default(1),
  entradaMinima: camposDaForma.entradaMinima.default(() => new Decimal(0)),
  carenciaMaximaDias: camposDaForma.carenciaMaximaDias.default(0),
  descontoAvista: camposDaForma.descontoAvista.default(() => new Decimal(0)),
  ativa: camposDaForma.ativa.default(false),
});

export const esquemaMudancaDeForma = z.object({
  nome: camposDaForma.nome.optional(),
  taxaMensal: camposDaForma.taxaMensal.optional(),
  parcelasMinimas: camposDaForma.parcelasMinimas.optional(),
  parcelasMaximas: camposDaForma.parcelasMaximas.optional(),
  entradaMinima: camposDaForma.entradaMinima.optional(),
  carenciaMaximaDias: camposDaForma.carenciaMaximaDias.optional(),
  descontoAvista: camposDaForma.descontoAvista.optional(),
  ativa: camposDaForma.ativa.optional(),
}).refine((mudanca) => Object.keys(mudanca).length > 0, { message: 'Informe o que mudar.', path: ['corpo'] });

const usuarioDa = (resposta: Response) => usuarioDaSessao(resposta).id;

export async function obterConfiguracao(_requisicao: Request, resposta: Response): Promise<void> {
  resposta.json({ configuracao: await consultarConfiguracao() });
}

export async function editarConfiguracao(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json({ configuracao: await alterarConfiguracao(requisicao.body as z.infer<typeof esquemaConfiguracao>, usuarioDa(resposta)) });
}

export async function listarFormas(_requisicao: Request, resposta: Response): Promise<void> {
  resposta.json({ formas: await consultarFormas() });
}

// Pública, para a pergunta "como prefere pagar": só nome e tipo das formas ativas, sem taxas.
export async function listarFormasPublicas(_requisicao: Request, resposta: Response): Promise<void> {
  const formas = await consultarFormas(true);
  resposta.json({ formas: formas.map(({ nome, tipo }) => ({ nome, tipo })) });
}

export async function criarForma(requisicao: Request, resposta: Response): Promise<void> {
  resposta.status(201).json({ forma: await cadastrarForma(requisicao.body as z.infer<typeof esquemaNovaForma>, usuarioDa(resposta)) });
}

export async function editarForma(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  resposta.json({ forma: await alterarForma(id, requisicao.body as z.infer<typeof esquemaMudancaDeForma>, usuarioDa(resposta)) });
}
