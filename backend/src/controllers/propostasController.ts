import type { Request, Response } from 'express';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { lerEntrada } from '../middlewares/validar.ts';
import { alterarEquipamento, cadastrarEquipamento, consultarCatalogo } from '../services/equipamentosService.ts';
import { abrirProposta, buscarPropostas, gerarProposta, mudarStatusDaProposta } from '../services/propostasService.ts';

const STATUS = ['enviada', 'aceita', 'recusada'] as const;
const esquemaId = z.object({ id: z.coerce.number().int().positive() });
// Dinheiro chega como número no JSON e vira Decimal na hora; até 2 casas.
const preco = z.number().positive().max(1_000_000).refine((valor) => /^\d+(\.\d{1,2})?$/.test(String(valor)), 'Use até 2 casas decimais.');

// Só a escolha dos equipamentos: preço, quantidades e premissas são calculados no backend.
export const esquemaNovaProposta = z.object({
  simulacao: z.uuid('Simulação inválida.'),
  moduloId: z.number().int().positive(),
  inversorId: z.number().int().positive(),
});

export const esquemaStatus = z.object({ status: z.enum(STATUS) });

export const esquemaNovoEquipamento = z.object({
  tipo: z.enum(['modulo', 'inversor']),
  fabricante: z.string().trim().min(1).max(80),
  modelo: z.string().trim().min(1).max(120),
  potenciaW: z.number().positive().max(1_000_000),
  degradacaoAnual: z.number().min(0.002).max(0.01).optional(),
  preco,
}).refine(({ tipo, potenciaW }) => tipo === 'inversor' || (potenciaW >= 100 && potenciaW <= 800), {
  message: 'Módulo precisa ter entre 100 e 800 W.', path: ['potenciaW'],
}).refine(({ tipo, degradacaoAnual }) => tipo === 'modulo' || degradacaoAnual === undefined, {
  message: 'Só módulo tem degradação anual.', path: ['degradacaoAnual'],
});

export const esquemaMudancaDeEquipamento = z.object({ preco: preco.optional(), ativo: z.boolean().optional() })
  .refine((mudanca) => mudanca.preco !== undefined || mudanca.ativo !== undefined, { message: 'Informe o preço ou se está ativo.', path: ['corpo'] });

const esquemaListaDePropostas = z.object({
  status: z.enum(STATUS).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).default(20).transform((quantidade) => Math.min(quantidade, 100)),
});

const decimal = (valor: number) => new Decimal(String(valor));

export async function criarProposta(requisicao: Request, resposta: Response): Promise<void> {
  resposta.status(201).json({ proposta: await gerarProposta(requisicao.body as z.infer<typeof esquemaNovaProposta>) });
}

export async function listarPropostasDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json(await buscarPropostas(lerEntrada(esquemaListaDePropostas, requisicao.query)));
}

export async function obterProposta(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json({ proposta: await abrirProposta(lerEntrada(esquemaId, requisicao.params).id) });
}

export async function alterarStatusDaProposta(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  resposta.json({ proposta: await mudarStatusDaProposta(id, (requisicao.body as z.infer<typeof esquemaStatus>).status) });
}

export async function listarEquipamentosDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  const { tipo } = lerEntrada(z.object({ tipo: z.enum(['modulo', 'inversor']).optional() }), requisicao.query);
  resposta.json({ equipamentos: await consultarCatalogo(tipo) });
}

export async function criarEquipamento(requisicao: Request, resposta: Response): Promise<void> {
  const dados = requisicao.body as z.infer<typeof esquemaNovoEquipamento>;
  const equipamento = await cadastrarEquipamento({
    tipo: dados.tipo, fabricante: dados.fabricante, modelo: dados.modelo, potenciaW: decimal(dados.potenciaW),
    degradacaoAnual: dados.degradacaoAnual === undefined ? null : decimal(dados.degradacaoAnual), preco: decimal(dados.preco),
  });
  resposta.status(201).json({ equipamento });
}

export async function alterarEquipamentoDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  const mudanca = requisicao.body as z.infer<typeof esquemaMudancaDeEquipamento>;
  resposta.json({ equipamento: await alterarEquipamento(id, { preco: mudanca.preco === undefined ? undefined : decimal(mudanca.preco), ativo: mudanca.ativo }) });
}
