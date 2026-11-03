import type { Request, Response } from 'express';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { ErroHttp } from '../middlewares/erros.ts';
import { consultarCep } from '../services/cepService.ts';
import { simularEconomia } from '../services/simulacaoService.ts';

const cep = z.string().regex(/^\d{5}-?\d{3}$/, 'Informe o CEP com 8 números.').transform((valor) => valor.replace('-', ''));

// Só dados do visitante: tarifa, preço e premissas vêm do banco e do parametros.json, nunca do corpo.
export const esquemaSimulacao = z.object({
  cep,
  tipoLigacao: z.enum(['monofasico', 'bifasico', 'trifasico']),
  subgrupo: z.enum(['B1', 'B2', 'B3']).default('B1'),
  consumoMedioKwh: z.number().min(1, 'Informe um consumo de pelo menos 1 kWh.').max(20_000, 'O simulador aceita até 20.000 kWh por mês.'),
});

export async function obterCep(requisicao: Request, resposta: Response): Promise<void> {
  const parametros = z.object({ cep }).safeParse(requisicao.params);
  if (!parametros.success) throw new ErroHttp(400, 'ENTRADA_INVALIDA', 'Dados inválidos. Confira os campos.', { cep: 'Informe o CEP com 8 números.' });
  const local = await consultarCep(parametros.data.cep);
  resposta.json({ cep: local.cep, cidade: local.cidade, uf: local.uf, atendido: local.atendido });
}

export async function criarSimulacao(requisicao: Request, resposta: Response): Promise<void> {
  const corpo = requisicao.body as z.infer<typeof esquemaSimulacao>;
  const simulacao = await simularEconomia({ ...corpo, consumoMedioKwh: new Decimal(String(corpo.consumoMedioKwh)) });
  resposta.status(201).json({ simulacao });
}
