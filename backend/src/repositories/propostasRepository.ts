import { Decimal } from 'decimal.js';
import type { Knex } from 'knex';
import { db } from '../database/conexao.ts';
import type { Cliente, Proposta, StatusDaProposta } from '../tipos/tabelas.ts';
import { buscarEquipamentosAtivos, type EquipamentoDoCatalogo } from './equipamentosRepository.ts';

export interface PropostaParaGravar {
  clienteId: number;
  simulacaoId: number;
  investimento: Decimal;
  validaAte: string;
  snapshot: unknown;
}

export interface PropostaGravada {
  id: number;
  clienteId: number;
  status: StatusDaProposta;
  investimento: Decimal;
  validaAte: string;
  snapshot: unknown;
  criadoEm: Date;
}

export interface PropostaDaLista extends Omit<PropostaGravada, 'snapshot'> {
  clienteNome: string;
}

type Montagem = (modulo: EquipamentoDoCatalogo | undefined, inversor: EquipamentoDoCatalogo | undefined) => PropostaParaGravar;

// Preço calculado e gravado na mesma transação, com os equipamentos travados.
export async function gravarPropostaComPrecosDoCatalogo(ids: { moduloId: number; inversorId: number }, montar: Montagem): Promise<number> {
  return db.transaction(async (transacao) => {
    const equipamentos = await buscarEquipamentosAtivos(transacao, [ids.moduloId, ids.inversorId]);
    const proposta = montar(equipamentos.find((item) => item.id === ids.moduloId), equipamentos.find((item) => item.id === ids.inversorId));
    const [{ id }] = await transacao<Proposta>('proposta').insert({
      cliente_id: proposta.clienteId, simulacao_id: proposta.simulacaoId, investimento: proposta.investimento.toString(),
      valida_ate: proposta.validaAte, snapshot: JSON.stringify(proposta.snapshot),
    }).returning('id');
    return id;
  });
}

const COLUNAS_DA_LISTA = ['proposta.id', 'proposta.cliente_id', 'proposta.status', 'proposta.investimento', 'proposta.valida_ate', 'proposta.criado_em', 'cliente.nome'];

function comoPropostaDaLista(linha: Pick<Proposta, 'id' | 'cliente_id' | 'status' | 'investimento' | 'valida_ate' | 'criado_em'> & Pick<Cliente, 'nome'>): PropostaDaLista {
  return {
    id: linha.id, clienteId: linha.cliente_id, clienteNome: linha.nome, status: linha.status,
    investimento: new Decimal(linha.investimento), validaAte: linha.valida_ate, criadoEm: linha.criado_em,
  };
}

export interface FiltroDePropostas {
  status?: StatusDaProposta;
  clienteId?: number;
  pagina: number;
  porPagina: number;
}

function filtrarPropostas(consulta: Knex.QueryBuilder, { status, clienteId }: FiltroDePropostas): void {
  if (status) consulta.where('proposta.status', status);
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

export async function buscarProposta(id: number): Promise<PropostaGravada | undefined> {
  const linha = await db<Proposta>('proposta').select('id', 'cliente_id', 'status', 'investimento', 'valida_ate', 'snapshot', 'criado_em').where({ id }).first();
  return linha && {
    id: linha.id, clienteId: linha.cliente_id, status: linha.status, investimento: new Decimal(linha.investimento),
    validaAte: linha.valida_ate, snapshot: linha.snapshot, criadoEm: linha.criado_em,
  };
}

export async function atualizarStatusDaProposta(id: number, status: StatusDaProposta): Promise<boolean> {
  const alteradas = await db<Proposta>('proposta').where({ id }).update({ status, atualizado_em: new Date() });
  return alteradas > 0;
}

export async function contarPropostasPorStatus(): Promise<Record<StatusDaProposta, number>> {
  const linhas = await db<Proposta>('proposta').select('status').count<{ status: StatusDaProposta; total: string }[]>({ total: '*' }).groupBy('status');
  const contagem: Record<StatusDaProposta, number> = { enviada: 0, aceita: 0, recusada: 0 };
  for (const { status, total } of linhas) contagem[status] = Number(total);
  return contagem;
}
