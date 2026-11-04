// Orçamentos e catálogo de equipamentos da área restrita. Só valida a entrada: regras e cálculo ficam nos services.
import type { Request, Response } from 'express';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { usuarioDaSessao } from '../middlewares/autenticar.ts';
import { lerEntrada } from '../middlewares/validar.ts';
import { alterarEquipamento, cadastrarEquipamento, consultarCatalogo } from '../services/equipamentosService.ts';
import {
  abrirProposta, adicionarAjuste, adicionarCondicao, buscarPropostas, criarNovaVersao, descartarRascunho, duplicarProposta, editarRascunho, enviarProposta,
  gerarProposta, mudarStatusDaProposta, removerAjuste, removerCondicao,
} from '../services/propostasService.ts';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const esquemaIdDoItem = z.object({ id: z.coerce.number().int().positive(), itemId: z.coerce.number().int().positive() });
const idDeEquipamento = z.number().int().positive();
// Dinheiro chega como número no JSON e vira Decimal na hora; até 2 casas.
const preco = z.number().positive().max(1_000_000).refine((valor) => /^\d+(\.\d{1,2})?$/.test(String(valor)), 'Use até 2 casas decimais.');
const justificativa = z.string().trim().min(3, 'Explique o motivo.').max(500, 'Justificativa longa demais.');

// Só a escolha dos equipamentos: preço, quantidades e premissas são calculados no backend.
export const esquemaNovaProposta = z.object({
  simulacao: z.uuid('Simulação inválida.'),
  moduloId: idDeEquipamento,
  inversorId: idDeEquipamento,
});

// Revisão do operador: as mesmas faixas aceitas nos parâmetros técnicos.
const esquemaRevisao = z.strictObject({
  performanceRatio: z.number().min(0.70, 'O PR fica entre 0,70 e 0,85.').max(0.85, 'O PR fica entre 0,70 e 0,85.').optional(),
  simultaneidade: z.number().min(0.10, 'A simultaneidade fica entre 0,10 e 0,70.').max(0.70, 'A simultaneidade fica entre 0,10 e 0,70.').optional(),
  telhado: z.strictObject({
    horasDeSol: z.enum(['diaTodo', 'de6a8', 'de4a6', 'menosDe4']).optional(),
    orientacao: z.enum(['norte', 'nordeste', 'noroeste', 'leste', 'oeste', 'sudeste', 'sudoeste', 'sul', 'plano']).optional(),
    inclinacao: z.enum(['plano', 'pouca', 'media', 'muita']).optional(),
  }).optional(),
  quantidadeDeModulos: z.number().int().min(1).max(5_000).optional(),
});

export const esquemaEdicaoDoRascunho = z.object({
  moduloId: idDeEquipamento.optional(),
  inversorId: idDeEquipamento.optional(),
  revisao: esquemaRevisao.optional(),
  justificativa: justificativa.optional(),
  observacoes: z.string().trim().max(2_000, 'Observações longas demais.').nullable().optional(),
}).refine((edicao) => Object.keys(edicao).some((campo) => campo !== 'justificativa'), { message: 'Informe o que mudar.', path: ['corpo'] });

export const esquemaAjuste = z.object({
  tipo: z.enum(['desconto', 'acrescimo']),
  descricao: z.string().trim().min(3, 'Descreva o ajuste.').max(200, 'Descrição longa demais.'),
  modo: z.enum(['valor', 'percentual']),
  // Em reais, ou fração do preço calculado (0.05 = 5%).
  valor: z.number().positive('Informe um valor maior que zero.').max(1_000_000),
  justificativa: justificativa.optional(),
}).refine(({ modo, valor }) => modo === 'valor' || valor <= 1, { message: 'Percentual em fração: 0.05 para 5%.', path: ['valor'] });

export const esquemaCondicao = z.object({
  formaPagamentoId: z.number().int().positive(),
  // Sem entrada: a mínima da forma. Sem parcelas: o máximo da forma.
  entrada: preco.optional(),
  parcelas: z.number().int().min(1).max(600).optional(),
  carenciaDias: z.number().int().min(0).max(365).optional(),
});

export const esquemaTrocaNaCopia = z.object({ moduloId: idDeEquipamento.optional(), inversorId: idDeEquipamento.optional() });
export const esquemaStatus = z.object({ status: z.enum(['enviada', 'aceita', 'recusada']) });

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
  // "vencida": enviada com a validade passada (no banco, o status segue "enviada").
  status: z.enum(['rascunho', 'enviada', 'aceita', 'recusada', 'vencida']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).default(20).transform((quantidade) => Math.min(quantidade, 100)),
});

const decimal = (valor: number) => new Decimal(String(valor));

const usuarioDa = (resposta: Response) => usuarioDaSessao(resposta).id;

export async function criarProposta(requisicao: Request, resposta: Response): Promise<void> {
  resposta.status(201).json({ proposta: await gerarProposta(requisicao.body as z.infer<typeof esquemaNovaProposta>, usuarioDa(resposta)) });
}

export async function listarPropostasDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json(await buscarPropostas(lerEntrada(esquemaListaDePropostas, requisicao.query)));
}

export async function obterProposta(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json({ proposta: await abrirProposta(lerEntrada(esquemaId, requisicao.params).id) });
}

export async function editarProposta(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  resposta.json({ proposta: await editarRascunho(id, requisicao.body as z.infer<typeof esquemaEdicaoDoRascunho>, usuarioDa(resposta)) });
}

export async function incluirAjuste(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  const dados = requisicao.body as z.infer<typeof esquemaAjuste>;
  resposta.status(201).json({ proposta: await adicionarAjuste(id, { ...dados, valor: decimal(dados.valor) }, usuarioDa(resposta)) });
}

export async function excluirAjuste(requisicao: Request, resposta: Response): Promise<void> {
  const { id, itemId } = lerEntrada(esquemaIdDoItem, requisicao.params);
  resposta.json({ proposta: await removerAjuste(id, itemId, usuarioDa(resposta)) });
}

export async function incluirCondicao(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  const { entrada, ...dados } = requisicao.body as z.infer<typeof esquemaCondicao>;
  resposta.status(201).json({ proposta: await adicionarCondicao(id, { ...dados, entrada: entrada === undefined ? undefined : decimal(entrada) }, usuarioDa(resposta)) });
}

export async function excluirCondicao(requisicao: Request, resposta: Response): Promise<void> {
  const { id, itemId } = lerEntrada(esquemaIdDoItem, requisicao.params);
  resposta.json({ proposta: await removerCondicao(id, itemId, usuarioDa(resposta)) });
}

export async function enviarOrcamento(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  resposta.json({ proposta: await enviarProposta(id, usuarioDa(resposta)) });
}

export async function novaVersao(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  resposta.status(201).json({ proposta: await criarNovaVersao(id, requisicao.body as z.infer<typeof esquemaTrocaNaCopia>, usuarioDa(resposta)) });
}

export async function duplicar(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  resposta.status(201).json({ proposta: await duplicarProposta(id, requisicao.body as z.infer<typeof esquemaTrocaNaCopia>, usuarioDa(resposta)) });
}

export async function excluirRascunhoDaProposta(requisicao: Request, resposta: Response): Promise<void> {
  await descartarRascunho(lerEntrada(esquemaId, requisicao.params).id);
  resposta.status(204).end();
}

export async function alterarStatusDaProposta(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  resposta.json({ proposta: await mudarStatusDaProposta(id, (requisicao.body as z.infer<typeof esquemaStatus>).status, usuarioDa(resposta)) });
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
