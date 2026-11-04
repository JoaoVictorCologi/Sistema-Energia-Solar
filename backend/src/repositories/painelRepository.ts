// Totais do painel da área restrita.
import { Decimal } from 'decimal.js';
import { db } from '../database/conexao.ts';

export interface TotaisDoPainel {
  clientes: number;
  simulacoes: number;
  simulacoesComPedido: number;
  // Pedidos de proposta que ainda não viraram orçamento: o que o operador tem a fazer.
  pedidosNovos: number;
}

async function contar(consulta: Promise<{ total: string | number }[]>): Promise<number> {
  const [{ total }] = await consulta;
  return Number(total);
}

export async function contarTotais(): Promise<TotaisDoPainel> {
  const [clientes, simulacoes, simulacoesComPedido, pedidosNovos] = await Promise.all([
    contar(db('cliente').count({ total: '*' })),
    contar(db('simulacao').count({ total: '*' })),
    contar(db('simulacao').whereNotNull('cliente_id').count({ total: '*' })),
    contar(db('simulacao').whereNotNull('cliente_id').whereNotExists(db('proposta').select('id').whereRaw('proposta.simulacao_id = simulacao.id')).count({ total: '*' })),
  ]);
  return { clientes, simulacoes, simulacoesComPedido, pedidosNovos };
}

// Enviadas com a validade passada: o status segue "enviada" no banco, a data é que define.
export async function contarPropostasVencidas(hoje: string): Promise<number> {
  return contar(db('proposta').where({ status: 'enviada' }).where('valida_ate', '<', hoje).count({ total: '*' }));
}

export async function somarAceitasDesde(primeiroDiaDoMes: string): Promise<Decimal> {
  const [{ total }] = await db('proposta').where({ status: 'aceita' }).where('atualizado_em', '>=', `${primeiroDiaDoMes}T00:00:00-03:00`).sum({ total: 'investimento' });
  return new Decimal(total ?? 0);
}
