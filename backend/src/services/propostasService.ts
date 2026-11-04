// Orçamentos: nascem em rascunho, o operador ajusta e envia. Reabrir lê o snapshot; mudar tarifa, preço ou
// configuração depois não altera o que foi enviado. Alterar um orçamento enviado cria uma nova versão.
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { ErroHttp } from '../middlewares/erros.ts';
import { buscarClientePorId } from '../repositories/clientesRepository.ts';
import { buscarFormaDePagamento } from '../repositories/configuracoesRepository.ts';
import {
  alterarRascunho, atualizarStatusDaProposta, buscarProposta, criarRascunho, excluirRascunho, listarEventos, listarPropostas, listarVersoes,
  type MudancaNoRascunho, type NovoAjuste, type PropostaGravada,
} from '../repositories/propostasRepository.ts';
import { buscarSimulacaoPorCodigo, buscarSimulacaoPorId, type SimulacaoGravada } from '../repositories/simulacoesRepository.ts';
import type { ModoDoAjuste, StatusDaProposta, TipoDeAjuste } from '../tipos/tabelas.ts';
import { hojeEmSaoPaulo, somarDias } from '../utils/datas.ts';
import { montarOrcamento, type ContextoDaProposta } from './orcamentoCalculo.ts';
import { buscarReferencias } from './simulacaoService.ts';

// Simulações anteriores à cobertura nacional não gravavam a distribuidora: eram todas da CPFL Santa Cruz.
const DISTRIBUIDORA_DAS_SIMULACOES_ANTIGAS = { cnpj: '53859112000169', sigla: 'CPFL Santa Cruz' };

// O pedido gravado na simulação (Decimal vira texto no JSONB).
const decimalGravado = z.union([z.string(), z.number()]).transform((valor) => new Decimal(String(valor)));
const esquemaPedidoGravado = z.object({
  cep: z.string(),
  tipoLigacao: z.enum(['monofasico', 'bifasico', 'trifasico']),
  subgrupo: z.enum(['B1', 'B2', 'B3']),
  consumoMedioKwh: decimalGravado,
  distribuidora: z.object({ cnpj: z.string(), sigla: z.string() }).default(DISTRIBUIDORA_DAS_SIMULACOES_ANTIGAS),
  conta: z.object({ valorReais: decimalGravado, consumoKwh: decimalGravado, iluminacaoPublicaReais: decimalGravado.optional() }).optional(),
  consumoMensalKwh: z.array(decimalGravado).optional(),
  perfilDeConsumo: z.enum(['noite', 'equilibrado', 'dia']).optional(),
  telhado: z.object({
    horasDeSol: z.enum(['diaTodo', 'de6a8', 'de4a6', 'menosDe4']).optional(),
    orientacao: z.enum(['norte', 'nordeste', 'noroeste', 'leste', 'oeste', 'sudeste', 'sudoeste', 'sul', 'plano']).optional(),
    inclinacao: z.enum(['plano', 'pouca', 'media', 'muita']).optional(),
    tipo: z.enum(['ceramica', 'metalico', 'fibrocimento', 'laje', 'solo']).optional(),
    areaM2: decimalGravado.optional(),
  }).optional(),
  solarExistente: z.object({ protocoloEm: z.string() }).optional(),
  aumentoPrevistoKwh: decimalGravado.optional(),
  pagamentoPreferido: z.enum(['avista', 'parcelado', 'financiado']).optional(),
});

const dinheiro = (valor: Decimal) => valor.toDecimalPlaces(2).toNumber();

function naoEncontrada(): ErroHttp {
  return new ErroHttp(404, 'PROPOSTA_NAO_ENCONTRADA', 'Proposta não encontrada.');
}

async function buscarPropostaOuFalhar(id: number): Promise<PropostaGravada> {
  const proposta = await buscarProposta(id);
  if (!proposta) throw naoEncontrada();
  return proposta;
}

async function carregarContexto(simulacao: SimulacaoGravada, agora: Date): Promise<ContextoDaProposta> {
  const cliente = simulacao.cliente_id === null ? undefined : await buscarClientePorId(simulacao.cliente_id);
  if (!cliente) throw new ErroHttp(422, 'SIMULACAO_SEM_CLIENTE', 'Esta simulação não tem pedido de proposta de um cliente.');
  const pedido = esquemaPedidoGravado.parse((simulacao.entrada as { pedido: unknown }).pedido);
  const hoje = hojeEmSaoPaulo(agora);
  return { simulacao, cliente, pedido, referencias: await buscarReferencias(simulacao.codigo_ibge, pedido.subgrupo, hoje, pedido.distribuidora), hoje };
}

async function contextoDaProposta(proposta: PropostaGravada, agora: Date): Promise<ContextoDaProposta> {
  const simulacao = await buscarSimulacaoPorId(proposta.simulacaoId);
  if (!simulacao) throw new ErroHttp(404, 'SIMULACAO_NAO_ENCONTRADA', 'Simulação não encontrada.');
  return carregarContexto(simulacao, agora);
}

// A entrada completa do motor fica no snapshot para reproduzir o cálculo, mas não vai para a tela.
function comoPropostaDaApi(proposta: PropostaGravada, hoje: string) {
  const { entradaDoMotor: _paraAuditoria, ...snapshot } = proposta.snapshot as { entradaDoMotor?: unknown };
  return {
    id: proposta.id, clienteId: proposta.clienteId, status: proposta.status, vencida: proposta.status === 'enviada' && proposta.validaAte < hoje,
    versao: proposta.versao, propostaRaizId: proposta.propostaRaizId, observacoes: proposta.observacoes, escolhas: proposta.escolhas,
    investimento: dinheiro(proposta.investimento), validaAte: proposta.validaAte, criadaEm: proposta.criadoEm, ...snapshot,
  };
}

// Só lê o snapshot: nada é recalculado.
export async function abrirProposta(id: number, agora = new Date()) {
  const proposta = await buscarPropostaOuFalhar(id);
  const [historico, versoes] = await Promise.all([listarEventos(id), listarVersoes(proposta.propostaRaizId ?? id)]);
  return {
    ...comoPropostaDaApi(proposta, hojeEmSaoPaulo(agora)),
    historico,
    versoes: versoes.map((versao) => ({ ...versao, investimento: dinheiro(versao.investimento) })),
  };
}

export async function gerarProposta(pedido: { simulacao: string; moduloId: number; inversorId: number }, usuarioId: number | null = null, agora = new Date()) {
  const simulacao = await buscarSimulacaoPorCodigo(pedido.simulacao);
  if (!simulacao) throw new ErroHttp(404, 'SIMULACAO_NAO_ENCONTRADA', 'Simulação não encontrada.');
  const contexto = await carregarContexto(simulacao, agora);
  const id = await criarRascunho({
    clienteId: contexto.cliente.id, simulacaoId: simulacao.id, escolhas: { moduloId: pedido.moduloId, inversorId: pedido.inversorId },
    versao: 1, raizId: null, observacoes: null, validaAte: somarDias(contexto.hoje, contexto.referencias.configuracao.validadeDias),
    evento: { usuarioId, tipo: 'criada', descricao: 'Orçamento criado a partir da simulação.' },
  }, (estado) => montarOrcamento(contexto, estado));
  return abrirProposta(id, agora);
}

// Caminho único de toda alteração de rascunho: recalcula dentro da transação e traduz o resultado nos erros da API.
async function alterar(id: number, mudanca: MudancaNoRascunho, agora: Date) {
  const proposta = await buscarPropostaOuFalhar(id);
  const contexto = await contextoDaProposta(proposta, agora);
  const resultado = await alterarRascunho(id, mudanca, (estado) => montarOrcamento(contexto, estado));
  if (resultado === 'nao_encontrada') throw naoEncontrada();
  if (resultado === 'congelada') throw new ErroHttp(409, 'PROPOSTA_CONGELADA', 'Orçamento enviado não muda: crie uma nova versão.');
  if (resultado === 'item_nao_encontrado') throw new ErroHttp(404, 'ITEM_NAO_ENCONTRADO', 'Item não encontrado neste orçamento.');
  return abrirProposta(id, agora);
}

export interface EdicaoDoRascunho {
  moduloId?: number;
  inversorId?: number;
  revisao?: Record<string, unknown>;
  justificativa?: string;
  observacoes?: string | null;
}

// Trocar equipamento ou premissa precisa de justificativa; observações não.
export async function editarRascunho(id: number, edicao: EdicaoDoRascunho, usuarioId: number | null, agora = new Date()) {
  const proposta = await buscarPropostaOuFalhar(id);
  const mudaCalculo = edicao.moduloId !== undefined || edicao.inversorId !== undefined || edicao.revisao !== undefined;
  if (mudaCalculo && !edicao.justificativa) {
    throw new ErroHttp(400, 'JUSTIFICATIVA_OBRIGATORIA', 'Explique o motivo da revisão.', { justificativa: 'Explique o motivo da revisão.' });
  }
  const escolhas = {
    moduloId: edicao.moduloId ?? proposta.escolhas.moduloId,
    inversorId: edicao.inversorId ?? proposta.escolhas.inversorId,
    revisao: edicao.revisao ?? proposta.escolhas.revisao,
  };
  return alterar(id, {
    escolhas, observacoes: edicao.observacoes,
    evento: { usuarioId, tipo: mudaCalculo ? 'revisao' : 'observacoes', descricao: mudaCalculo ? 'Equipamentos ou premissas revisados.' : 'Observações internas alteradas.', justificativa: edicao.justificativa ?? null },
  }, agora);
}

export async function adicionarAjuste(id: number, dados: { tipo: TipoDeAjuste; descricao: string; modo: ModoDoAjuste; valor: Decimal; justificativa?: string }, usuarioId: number | null, agora = new Date()) {
  const novoAjuste: NovoAjuste = { tipo: dados.tipo, descricao: dados.descricao, modo: dados.modo, valor: dados.valor, justificativa: dados.justificativa ?? null };
  const rotulo = dados.modo === 'percentual' ? `${dados.valor.times(100).toString().replace('.', ',')}%` : `R$ ${dados.valor.toFixed(2).replace('.', ',')}`;
  return alterar(id, {
    novoAjuste,
    evento: { usuarioId, tipo: 'ajuste_adicionado', descricao: `${dados.tipo === 'desconto' ? 'Desconto' : 'Acréscimo'} de ${rotulo}: ${dados.descricao}`.slice(0, 300), justificativa: dados.justificativa ?? null },
  }, agora);
}

export async function removerAjuste(id: number, ajusteId: number, usuarioId: number | null, agora = new Date()) {
  return alterar(id, { removerAjusteId: ajusteId, evento: { usuarioId, tipo: 'ajuste_removido', descricao: 'Ajuste removido.' } }, agora);
}

// A forma precisa estar ativa; prazo e carência dentro dos limites dela. A condição guarda uma cópia da forma.
export async function adicionarCondicao(id: number, dados: { formaPagamentoId: number; entrada?: Decimal; parcelas?: number; carenciaDias?: number }, usuarioId: number | null, agora = new Date()) {
  const forma = await buscarFormaDePagamento(dados.formaPagamentoId);
  if (!forma?.ativa) throw new ErroHttp(400, 'FORMA_INVALIDA', 'Escolha uma forma de pagamento ativa.', { formaPagamentoId: 'Forma de pagamento inativa ou inexistente.' });
  const parcelas = dados.parcelas ?? forma.parcelasMaximas;
  const carenciaDias = dados.carenciaDias ?? 0;
  if (parcelas < forma.parcelasMinimas || parcelas > forma.parcelasMaximas) {
    throw new ErroHttp(400, 'ENTRADA_INVALIDA', 'Dados inválidos. Confira os campos.', { parcelas: `${forma.nome} aceita de ${forma.parcelasMinimas} a ${forma.parcelasMaximas} parcelas.` });
  }
  if (carenciaDias > forma.carenciaMaximaDias) {
    throw new ErroHttp(400, 'ENTRADA_INVALIDA', 'Dados inválidos. Confira os campos.', { carenciaDias: `${forma.nome} aceita até ${forma.carenciaMaximaDias} dias de carência.` });
  }
  return alterar(id, {
    novaCondicao: {
      formaPagamentoId: forma.id, nome: forma.nome, tipo: forma.tipo, taxaMensal: forma.taxaMensal ?? new Decimal(0), descontoAvista: forma.descontoAvista,
      entradaMinima: forma.entradaMinima, entrada: forma.tipo === 'avista' ? null : dados.entrada ?? null, parcelas, carenciaDias,
    },
    evento: { usuarioId, tipo: 'condicao_adicionada', descricao: `Condição de pagamento: ${forma.nome}, ${parcelas}x.` },
  }, agora);
}

export async function removerCondicao(id: number, condicaoId: number, usuarioId: number | null, agora = new Date()) {
  return alterar(id, { removerCondicaoId: condicaoId, evento: { usuarioId, tipo: 'condicao_removida', descricao: 'Condição de pagamento removida.' } }, agora);
}

// Recalcula com a tarifa e os preços do dia e congela. Sem condição de pagamento, o cliente não saberia como pagar.
export async function enviarProposta(id: number, usuarioId: number | null, agora = new Date()) {
  const proposta = await buscarPropostaOuFalhar(id);
  if (proposta.status === 'rascunho' && (proposta.snapshot as { condicoes?: unknown[] }).condicoes?.length === 0) {
    throw new ErroHttp(422, 'PROPOSTA_SEM_CONDICAO', 'Inclua ao menos uma condição de pagamento antes de enviar.');
  }
  return alterar(id, { enviar: true, evento: { usuarioId, tipo: 'enviada', descricao: 'Orçamento enviado ao cliente.' } }, agora);
}

export async function criarNovaVersao(id: number, troca: { moduloId?: number; inversorId?: number }, usuarioId: number | null, agora = new Date()) {
  const origem = await buscarPropostaOuFalhar(id);
  if (origem.status === 'rascunho') throw new ErroHttp(409, 'PROPOSTA_EM_RASCUNHO', 'Este orçamento ainda é rascunho: edite direto, sem criar outra versão.');
  const raizId = origem.propostaRaizId ?? origem.id;
  const versoes = await listarVersoes(raizId);
  const rascunho = versoes.find((versao) => versao.status === 'rascunho');
  if (rascunho) throw new ErroHttp(409, 'RASCUNHO_JA_EXISTE', `Já existe a versão ${rascunho.versao} em rascunho (orçamento ${rascunho.id}).`);
  const versao = Math.max(...versoes.map((item) => item.versao)) + 1;
  return copiar(origem, { versao, raizId, troca, usuarioId, tipo: 'nova_versao', descricao: `Versão ${versao} criada a partir da versão ${origem.versao}.` }, agora);
}

export async function duplicarProposta(id: number, troca: { moduloId?: number; inversorId?: number }, usuarioId: number | null, agora = new Date()) {
  const origem = await buscarPropostaOuFalhar(id);
  return copiar(origem, { versao: 1, raizId: null, troca, usuarioId, tipo: 'duplicada', descricao: `Duplicado do orçamento ${origem.id}.` }, agora);
}

interface DadosDaCopia {
  versao: number;
  raizId: number | null;
  troca: { moduloId?: number; inversorId?: number };
  usuarioId: number | null;
  tipo: string;
  descricao: string;
}

// Base da nova versão e da duplicação: copia os itens da origem e recalcula com os valores do dia.
async function copiar(origem: PropostaGravada, dados: DadosDaCopia, agora: Date) {
  const contexto = await contextoDaProposta(origem, agora);
  const id = await criarRascunho({
    clienteId: origem.clienteId, simulacaoId: origem.simulacaoId, escolhas: { ...origem.escolhas, ...dados.troca }, versao: dados.versao, raizId: dados.raizId,
    observacoes: origem.observacoes, validaAte: somarDias(contexto.hoje, contexto.referencias.configuracao.validadeDias), copiarDe: origem.id,
    evento: { usuarioId: dados.usuarioId, tipo: dados.tipo, descricao: dados.descricao },
  }, (estado) => montarOrcamento(contexto, estado));
  return abrirProposta(id, agora);
}

export async function descartarRascunho(id: number): Promise<void> {
  if (await excluirRascunho(id)) return;
  // Nada foi excluído: ou o orçamento não existe (404), ou já foi enviado (409).
  await buscarPropostaOuFalhar(id);
  throw new ErroHttp(409, 'PROPOSTA_CONGELADA', 'Só rascunho pode ser excluído: orçamento enviado fica no histórico.');
}

// Rascunho só sai pelo envio. Fora da validade, nada passa a aceita, venha de qual status vier: o preço pode ter
// mudado, então o caminho é uma nova versão. O aceite dado dentro do prazo continua valendo depois do vencimento.
export async function mudarStatusDaProposta(id: number, status: Exclude<StatusDaProposta, 'rascunho'>, usuarioId: number | null, agora = new Date()) {
  const proposta = await buscarPropostaOuFalhar(id);
  if (proposta.status === 'rascunho') throw new ErroHttp(409, 'PROPOSTA_EM_RASCUNHO', 'Envie o orçamento antes de mudar o status.');
  if (status === 'aceita' && proposta.status !== 'aceita' && proposta.validaAte < hojeEmSaoPaulo(agora)) {
    throw new ErroHttp(409, 'PROPOSTA_VENCIDA', 'Este orçamento venceu: crie uma nova versão com os valores atuais.');
  }
  await atualizarStatusDaProposta(id, status, { usuarioId, tipo: 'status', descricao: `Status alterado de ${proposta.status} para ${status}.` });
  return abrirProposta(id, agora);
}

export interface FiltroDaLista {
  status?: StatusDaProposta | 'vencida';
  clienteId?: number;
  pagina: number;
  porPagina: number;
}

export async function buscarPropostas({ status, ...filtro }: FiltroDaLista, agora = new Date()) {
  const hoje = hojeEmSaoPaulo(agora);
  const { propostas, total } = await listarPropostas({ ...filtro, ...(status === 'vencida' ? { vencidasEm: hoje } : status && { status }) });
  return {
    propostas: propostas.map((proposta) => ({ ...proposta, investimento: dinheiro(proposta.investimento), vencida: proposta.status === 'enviada' && proposta.validaAte < hoje })),
    pagina: filtro.pagina, porPagina: filtro.porPagina, total,
  };
}
