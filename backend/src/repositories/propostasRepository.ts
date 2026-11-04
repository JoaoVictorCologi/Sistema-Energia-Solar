// Orçamentos. Toda gravação que envolve mais de uma tabela roda numa transação, com o cálculo dentro dela.
import { Decimal } from 'decimal.js';
import type { Knex } from 'knex';
import { db } from '../database/conexao.ts';
import type {
  Cliente, ModoDoAjuste, Proposta, PropostaAjuste, PropostaCondicao, PropostaEvento, StatusDaProposta, TipoDeAjuste, TipoDePagamento, Usuario,
} from '../tipos/tabelas.ts';
import { buscarEquipamentosAtivos, type EquipamentoDoCatalogo } from './equipamentosRepository.ts';

// Módulo, inversor e revisão do operador: o que se refaz a cada alteração do rascunho.
export interface EscolhasDaProposta {
  moduloId: number;
  inversorId: number;
  revisao?: Record<string, unknown>;
}

export interface AjusteGravado {
  id: number;
  tipo: TipoDeAjuste;
  descricao: string;
  modo: ModoDoAjuste;
  valor: Decimal;
  justificativa: string | null;
}

export type NovoAjuste = Omit<AjusteGravado, 'id'>;

export interface CondicaoGravada {
  id: number;
  formaPagamentoId: number;
  nome: string;
  tipo: TipoDePagamento;
  taxaMensal: Decimal;
  descontoAvista: Decimal;
  entradaMinima: Decimal;
  // Vazia: a entrada mínima da forma.
  entrada: Decimal | null;
  parcelas: number;
  carenciaDias: number;
}

export type NovaCondicao = Omit<CondicaoGravada, 'id'>;

export interface EstadoDoRascunho {
  escolhas: EscolhasDaProposta;
  modulo: EquipamentoDoCatalogo | undefined;
  inversor: EquipamentoDoCatalogo | undefined;
  ajustes: AjusteGravado[];
  condicoes: CondicaoGravada[];
}

export interface PropostaCalculada {
  investimento: Decimal;
  validaAte: string;
  snapshot: unknown;
}

// Calcula com o estado lido dentro da transação; um erro aqui desfaz a alteração inteira.
export type Calculo = (estado: EstadoDoRascunho) => PropostaCalculada;

export interface Evento {
  usuarioId: number | null;
  tipo: string;
  descricao: string;
  justificativa?: string | null;
}

export interface PropostaGravada {
  id: number;
  clienteId: number;
  simulacaoId: number;
  status: StatusDaProposta;
  investimento: Decimal;
  validaAte: string;
  snapshot: unknown;
  escolhas: EscolhasDaProposta;
  versao: number;
  propostaRaizId: number | null;
  observacoes: string | null;
  criadoEm: Date;
}

export interface PropostaDaLista {
  id: number;
  clienteId: number;
  clienteNome: string;
  status: StatusDaProposta;
  investimento: Decimal;
  validaAte: string;
  versao: number;
  criadoEm: Date;
}

export interface FiltroDePropostas {
  status?: StatusDaProposta;
  // Enviadas com a validade vencida: o status segue "enviada" no banco, a data é que define.
  vencidasEm?: string;
  clienteId?: number;
  pagina: number;
  porPagina: number;
}

const COLUNAS_DA_PROPOSTA = [
  'id', 'cliente_id', 'simulacao_id', 'status', 'investimento', 'valida_ate', 'snapshot', 'escolhas', 'versao', 'proposta_raiz_id', 'observacoes', 'criado_em',
] as const;
const COLUNAS_DA_LISTA = [
  'proposta.id', 'proposta.cliente_id', 'proposta.status', 'proposta.investimento', 'proposta.valida_ate', 'proposta.versao', 'proposta.criado_em', 'cliente.nome',
];

function comoProposta(linha: Pick<Proposta, (typeof COLUNAS_DA_PROPOSTA)[number]>): PropostaGravada {
  return {
    id: linha.id, clienteId: linha.cliente_id, simulacaoId: linha.simulacao_id, status: linha.status, investimento: new Decimal(linha.investimento),
    validaAte: linha.valida_ate, snapshot: linha.snapshot, escolhas: linha.escolhas as EscolhasDaProposta, versao: linha.versao,
    propostaRaizId: linha.proposta_raiz_id, observacoes: linha.observacoes, criadoEm: linha.criado_em,
  };
}

function comoAjuste(linha: PropostaAjuste): AjusteGravado {
  return { id: linha.id, tipo: linha.tipo, descricao: linha.descricao, modo: linha.modo, valor: new Decimal(linha.valor), justificativa: linha.justificativa };
}

function comoCondicao(linha: PropostaCondicao): CondicaoGravada {
  return {
    id: linha.id, formaPagamentoId: linha.forma_pagamento_id, nome: linha.nome, tipo: linha.tipo, taxaMensal: new Decimal(linha.taxa_mensal),
    descontoAvista: new Decimal(linha.desconto_avista), entradaMinima: new Decimal(linha.entrada_minima),
    entrada: linha.entrada === null ? null : new Decimal(linha.entrada), parcelas: linha.parcelas, carenciaDias: linha.carencia_dias,
  };
}

async function inserirEvento(transacao: Knex.Transaction, propostaId: number, evento: Evento): Promise<void> {
  await transacao<PropostaEvento>('proposta_evento').insert({
    proposta_id: propostaId, usuario_id: evento.usuarioId, tipo: evento.tipo, descricao: evento.descricao, justificativa: evento.justificativa ?? null,
  });
}

async function inserirAjuste(transacao: Knex.Transaction, propostaId: number, ajuste: NovoAjuste, usuarioId: number | null): Promise<void> {
  await transacao<PropostaAjuste>('proposta_ajuste').insert({
    proposta_id: propostaId, tipo: ajuste.tipo, descricao: ajuste.descricao, modo: ajuste.modo, valor: ajuste.valor.toString(), justificativa: ajuste.justificativa, criado_por: usuarioId,
  });
}

async function inserirCondicao(transacao: Knex.Transaction, propostaId: number, condicao: NovaCondicao, usuarioId: number | null): Promise<void> {
  await transacao<PropostaCondicao>('proposta_condicao').insert({
    proposta_id: propostaId, forma_pagamento_id: condicao.formaPagamentoId, nome: condicao.nome, tipo: condicao.tipo, taxa_mensal: condicao.taxaMensal.toString(),
    desconto_avista: condicao.descontoAvista.toString(), entrada_minima: condicao.entradaMinima.toString(), entrada: condicao.entrada?.toString() ?? null,
    parcelas: condicao.parcelas, carencia_dias: condicao.carenciaDias, criado_por: usuarioId,
  });
}

// Preço calculado e gravado na mesma transação, com os equipamentos travados.
async function recalcular(transacao: Knex.Transaction, propostaId: number, escolhas: EscolhasDaProposta, calcular: Calculo): Promise<PropostaCalculada> {
  const equipamentos = await buscarEquipamentosAtivos(transacao, [escolhas.moduloId, escolhas.inversorId]);
  const ajustes = await transacao<PropostaAjuste>('proposta_ajuste').select('*').where({ proposta_id: propostaId }).orderBy('id');
  const condicoes = await transacao<PropostaCondicao>('proposta_condicao').select('*').where({ proposta_id: propostaId }).orderBy('id');
  return calcular({
    escolhas,
    modulo: equipamentos.find((item) => item.id === escolhas.moduloId),
    inversor: equipamentos.find((item) => item.id === escolhas.inversorId),
    ajustes: ajustes.map(comoAjuste),
    condicoes: condicoes.map(comoCondicao),
  });
}

async function gravarCalculo(transacao: Knex.Transaction, propostaId: number, calculada: PropostaCalculada, outros: Partial<Proposta> = {}): Promise<void> {
  await transacao<Proposta>('proposta').where({ id: propostaId }).update({
    ...outros, investimento: calculada.investimento.toString(), valida_ate: calculada.validaAte, snapshot: JSON.stringify(calculada.snapshot), atualizado_em: new Date(),
  });
}

export interface NovoRascunho {
  clienteId: number;
  simulacaoId: number;
  escolhas: EscolhasDaProposta;
  versao: number;
  raizId: number | null;
  observacoes: string | null;
  validaAte: string;
  // Nova versão ou duplicação: traz os ajustes e as condições da proposta de origem.
  copiarDe?: number;
  evento: Evento;
}

async function copiarItens(transacao: Knex.Transaction, origemId: number, destinoId: number, usuarioId: number | null): Promise<void> {
  const ajustes = await transacao<PropostaAjuste>('proposta_ajuste').select('*').where({ proposta_id: origemId }).orderBy('id');
  for (const ajuste of ajustes) await inserirAjuste(transacao, destinoId, comoAjuste(ajuste), usuarioId);
  const condicoes = await transacao<PropostaCondicao>('proposta_condicao').select('*').where({ proposta_id: origemId }).orderBy('id');
  for (const condicao of condicoes) await inserirCondicao(transacao, destinoId, comoCondicao(condicao), usuarioId);
}

export async function criarRascunho(dados: NovoRascunho, calcular: Calculo): Promise<number> {
  return db.transaction(async (transacao) => {
    // O snapshot só existe depois do cálculo, que precisa dos itens já ligados a esta proposta.
    const [{ id }] = await transacao<Proposta>('proposta').insert({
      cliente_id: dados.clienteId, simulacao_id: dados.simulacaoId, status: 'rascunho', investimento: '0', valida_ate: dados.validaAte, snapshot: '{}',
      escolhas: JSON.stringify(dados.escolhas), versao: dados.versao, proposta_raiz_id: dados.raizId, observacoes: dados.observacoes, criada_por: dados.evento.usuarioId,
    }).returning('id');
    if (dados.copiarDe) await copiarItens(transacao, dados.copiarDe, id, dados.evento.usuarioId);
    await gravarCalculo(transacao, id, await recalcular(transacao, id, dados.escolhas, calcular));
    await inserirEvento(transacao, id, dados.evento);
    return id;
  });
}

export interface MudancaNoRascunho {
  escolhas?: EscolhasDaProposta;
  observacoes?: string | null;
  novoAjuste?: NovoAjuste;
  removerAjusteId?: number;
  novaCondicao?: NovaCondicao;
  removerCondicaoId?: number;
  enviar?: boolean;
  evento: Evento;
}

export type ResultadoDaMudanca = 'alterada' | 'nao_encontrada' | 'congelada' | 'item_nao_encontrado';

async function aplicarItens(transacao: Knex.Transaction, id: number, mudanca: MudancaNoRascunho): Promise<boolean> {
  const { usuarioId } = mudanca.evento;
  if (mudanca.novoAjuste) await inserirAjuste(transacao, id, mudanca.novoAjuste, usuarioId);
  if (mudanca.novaCondicao) await inserirCondicao(transacao, id, mudanca.novaCondicao, usuarioId);
  if (mudanca.removerAjusteId && (await transacao<PropostaAjuste>('proposta_ajuste').where({ id: mudanca.removerAjusteId, proposta_id: id }).del()) === 0) return false;
  if (mudanca.removerCondicaoId && (await transacao<PropostaCondicao>('proposta_condicao').where({ id: mudanca.removerCondicaoId, proposta_id: id }).del()) === 0) return false;
  return true;
}

// Só o rascunho muda. A linha fica travada até o fim: duas alterações ao mesmo tempo não se atropelam.
export async function alterarRascunho(id: number, mudanca: MudancaNoRascunho, calcular: Calculo): Promise<ResultadoDaMudanca> {
  return db.transaction(async (transacao) => {
    const atual = await transacao<Proposta>('proposta').select('status', 'escolhas').where({ id }).forUpdate().first();
    if (!atual) return 'nao_encontrada';
    if (atual.status !== 'rascunho') return 'congelada';
    if (!(await aplicarItens(transacao, id, mudanca))) return 'item_nao_encontrado';

    const escolhas = mudanca.escolhas ?? (atual.escolhas as EscolhasDaProposta);
    await gravarCalculo(transacao, id, await recalcular(transacao, id, escolhas, calcular), {
      escolhas: JSON.stringify(escolhas),
      ...(mudanca.observacoes !== undefined && { observacoes: mudanca.observacoes }),
      ...(mudanca.enviar && { status: 'enviada' as const }),
    });
    await inserirEvento(transacao, id, mudanca.evento);
    return 'alterada';
  });
}

export async function atualizarStatusDaProposta(id: number, status: StatusDaProposta, evento: Evento): Promise<void> {
  await db.transaction(async (transacao) => {
    await transacao<Proposta>('proposta').where({ id }).update({ status, atualizado_em: new Date() });
    await inserirEvento(transacao, id, evento);
  });
}

// Só rascunho: orçamento enviado fica no histórico. Ajustes, condições e eventos vão junto (cascade).
export async function excluirRascunho(id: number): Promise<boolean> {
  return (await db<Proposta>('proposta').where({ id, status: 'rascunho' }).del()) > 0;
}

export async function buscarProposta(id: number): Promise<PropostaGravada | undefined> {
  const linha = await db<Proposta>('proposta').select(...COLUNAS_DA_PROPOSTA).where({ id }).first();
  return linha && comoProposta(linha);
}

export interface VersaoDaProposta {
  id: number;
  versao: number;
  status: StatusDaProposta;
  investimento: Decimal;
  validaAte: string;
  criadoEm: Date;
}

// A primeira versão e as que apontam para ela.
export async function listarVersoes(raizId: number): Promise<VersaoDaProposta[]> {
  const linhas = await db<Proposta>('proposta')
    .select('id', 'versao', 'status', 'investimento', 'valida_ate', 'criado_em')
    .where((condicao) => condicao.where({ id: raizId }).orWhere({ proposta_raiz_id: raizId }))
    .orderBy('versao');
  return linhas.map((linha) => ({ id: linha.id, versao: linha.versao, status: linha.status, investimento: new Decimal(linha.investimento), validaAte: linha.valida_ate, criadoEm: linha.criado_em }));
}

export interface EventoDaProposta {
  tipo: string;
  descricao: string;
  justificativa: string | null;
  usuario: string | null;
  criadoEm: Date;
}

export async function listarEventos(propostaId: number): Promise<EventoDaProposta[]> {
  const linhas: (Pick<PropostaEvento, 'tipo' | 'descricao' | 'justificativa' | 'criado_em'> & { nome: Usuario['nome'] | null })[] = await db<PropostaEvento>('proposta_evento')
    .leftJoin('usuario', 'usuario.id', 'proposta_evento.usuario_id')
    .where('proposta_evento.proposta_id', propostaId)
    .select('proposta_evento.tipo', 'proposta_evento.descricao', 'proposta_evento.justificativa', 'proposta_evento.criado_em', 'usuario.nome')
    .orderBy('proposta_evento.id');
  return linhas.map((linha) => ({ tipo: linha.tipo, descricao: linha.descricao, justificativa: linha.justificativa, usuario: linha.nome, criadoEm: linha.criado_em }));
}

function comoPropostaDaLista(linha: Pick<Proposta, 'id' | 'cliente_id' | 'status' | 'investimento' | 'valida_ate' | 'versao' | 'criado_em'> & Pick<Cliente, 'nome'>): PropostaDaLista {
  return {
    id: linha.id, clienteId: linha.cliente_id, clienteNome: linha.nome, status: linha.status,
    investimento: new Decimal(linha.investimento), validaAte: linha.valida_ate, versao: linha.versao, criadoEm: linha.criado_em,
  };
}

function filtrarPropostas(consulta: Knex.QueryBuilder, { status, vencidasEm, clienteId }: FiltroDePropostas): void {
  if (status) consulta.where('proposta.status', status);
  if (vencidasEm) consulta.where('proposta.status', 'enviada').where('proposta.valida_ate', '<', vencidasEm);
  if (clienteId) consulta.where('proposta.cliente_id', clienteId);
}

export async function listarPropostas(filtro: FiltroDePropostas): Promise<{ propostas: PropostaDaLista[]; total: number }> {
  const [linhas, contagem] = await Promise.all([
    db<Proposta>('proposta').join('cliente', 'cliente.id', 'proposta.cliente_id').modify(filtrarPropostas, filtro)
      .select(...COLUNAS_DA_LISTA).orderBy('proposta.criado_em', 'desc').orderBy('proposta.id', 'desc')
      .limit(filtro.porPagina).offset((filtro.pagina - 1) * filtro.porPagina),
    db<Proposta>('proposta').modify(filtrarPropostas, filtro).count<{ total: string }[]>({ total: '*' }),
  ]);
  return { propostas: linhas.map(comoPropostaDaLista), total: Number(contagem[0].total) };
}

// Status sem nenhuma proposta não vem na consulta, por isso a contagem começa em zero.
export async function contarPropostasPorStatus(): Promise<Record<StatusDaProposta, number>> {
  const linhas = await db<Proposta>('proposta').select('status').count<{ status: StatusDaProposta; total: string }[]>({ total: '*' }).groupBy('status');
  const contagem: Record<StatusDaProposta, number> = { rascunho: 0, enviada: 0, aceita: 0, recusada: 0 };
  for (const { status, total } of linhas) contagem[status] = Number(total);
  return contagem;
}
