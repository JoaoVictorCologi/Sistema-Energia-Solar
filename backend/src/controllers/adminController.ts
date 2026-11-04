// Consultas da área restrita: painel, clientes e simulações.
import type { Request, Response } from 'express';
import { z } from 'zod';
import { lerEntrada } from '../middlewares/validar.ts';
import { buscarClientes, buscarSimulacoes, detalharCliente, montarPainel } from '../services/adminService.ts';

const POR_PAGINA_MAXIMO = 100;

const esquemaLista = z.object({
  busca: z.string().trim().max(120).optional().transform((busca) => busca || undefined),
  pagina: z.coerce.number().int().min(1).default(1),
  // Pedido acima do máximo não é erro: vem limitado a 100.
  porPagina: z.coerce.number().int().min(1).default(20).transform((quantidade) => Math.min(quantidade, POR_PAGINA_MAXIMO)),
});

const esquemaId = z.object({ id: z.coerce.number().int().positive() });

const esquemaListaDeSimulacoes = z.object({
  de: z.iso.date().optional(),
  ate: z.iso.date().optional(),
  cidade: z.string().trim().max(100).optional().transform((cidade) => cidade || undefined),
  // Com ou sem pedido de proposta.
  comPedido: z.enum(['true', 'false']).optional().transform((valor) => (valor === undefined ? undefined : valor === 'true')),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).default(20).transform((quantidade) => Math.min(quantidade, POR_PAGINA_MAXIMO)),
});

export async function obterPainel(_requisicao: Request, resposta: Response): Promise<void> {
  resposta.json({ painel: await montarPainel() });
}

export async function listarClientesDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json(await buscarClientes(lerEntrada(esquemaLista, requisicao.query)));
}

export async function obterCliente(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  resposta.json(await detalharCliente(id));
}

export async function listarSimulacoesDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json(await buscarSimulacoes(lerEntrada(esquemaListaDeSimulacoes, requisicao.query)));
}
