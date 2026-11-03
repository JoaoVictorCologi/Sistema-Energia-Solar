// Leitura dos clientes. A gravação chega na tarefa 12 (pedido de proposta); os módulos só leem por aqui.
import type { Knex } from 'knex';
import { db } from '../database/conexao.ts';
import type { Cliente } from '../tipos/tabelas.ts';

export type ClienteResumo = Pick<Cliente, 'id' | 'nome' | 'email' | 'telefone' | 'cep' | 'aceite_em' | 'criado_em'>;

export interface FiltroDeClientes {
  busca?: string;
  pagina: number;
  porPagina: number;
}

const COLUNAS = ['id', 'nome', 'email', 'telefone', 'cep', 'aceite_em', 'criado_em'] as const;

// % e _ digitados na busca valem como texto, não como curinga do LIKE.
function comoTrechoDoLike(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)}%`;
}

function filtrarPorBusca(consulta: Knex.QueryBuilder, busca: string | undefined): void {
  if (!busca) return;
  const trecho = comoTrechoDoLike(busca);
  consulta.where((condicao) => condicao.whereILike('nome', trecho).orWhereILike('email', trecho));
}

export async function buscarClientePorId(id: number): Promise<ClienteResumo | undefined> {
  return db<Cliente>('cliente').select(...COLUNAS).where({ id }).first();
}

export async function listarClientes({ busca, pagina, porPagina }: FiltroDeClientes): Promise<{ clientes: ClienteResumo[]; total: number }> {
  const [clientes, contagem] = await Promise.all([
    db<Cliente>('cliente')
      .select(...COLUNAS)
      .modify(filtrarPorBusca, busca)
      .orderBy('criado_em', 'desc')
      .orderBy('id', 'desc')
      .limit(porPagina)
      .offset((pagina - 1) * porPagina),
    db<Cliente>('cliente').modify(filtrarPorBusca, busca).count<{ total: string }[]>({ total: '*' }),
  ]);
  return { clientes, total: Number(contagem[0].total) };
}
