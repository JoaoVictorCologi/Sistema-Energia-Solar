import type { Request, Response } from 'express';
import { z } from 'zod';
import { lerEntrada } from '../middlewares/validar.ts';
import { buscarClientes, detalharCliente, montarPainel } from '../services/adminService.ts';

const POR_PAGINA_MAXIMO = 100;

const esquemaLista = z.object({
  busca: z.string().trim().max(120).optional().transform((busca) => busca || undefined),
  pagina: z.coerce.number().int().min(1).default(1),
  // Pedido acima do máximo não é erro: vem limitado a 100.
  porPagina: z.coerce.number().int().min(1).default(20).transform((quantidade) => Math.min(quantidade, POR_PAGINA_MAXIMO)),
});

const esquemaId = z.object({ id: z.coerce.number().int().positive() });

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
