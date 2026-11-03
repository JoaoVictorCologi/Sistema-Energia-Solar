import { db } from '../database/conexao.ts';

export interface TotaisDoPainel {
  clientes: number;
  simulacoes: number;
  simulacoesComPedido: number;
}

async function contar(consulta: Promise<{ total: string | number }[]>): Promise<number> {
  const [{ total }] = await consulta;
  return Number(total);
}

export async function contarTotais(): Promise<TotaisDoPainel> {
  const [clientes, simulacoes, simulacoesComPedido] = await Promise.all([
    contar(db('cliente').count({ total: '*' })),
    contar(db('simulacao').count({ total: '*' })),
    contar(db('simulacao').whereNotNull('cliente_id').count({ total: '*' })),
  ]);
  return { clientes, simulacoes, simulacoesComPedido };
}
