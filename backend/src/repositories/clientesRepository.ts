// Clientes. Os módulos só leem por aqui (buscarClientePorId, listarClientes); a gravação é do pedido de proposta.
import type { Knex } from 'knex';
import { db } from '../database/conexao.ts';
import type { Cliente, ContatoPreferido, MelhorHorario, Simulacao } from '../tipos/tabelas.ts';
import { comoTrechoDoLike } from '../utils/busca.ts';

export type ClienteResumo = Pick<Cliente, 'id' | 'nome' | 'email' | 'telefone' | 'cep' | 'aceite_em' | 'criado_em'
  | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'contato_preferido' | 'melhor_horario' | 'autoriza_calibracao'>;

export interface FiltroDeClientes {
  busca?: string;
  pagina: number;
  porPagina: number;
}

const COLUNAS = [
  'id', 'nome', 'email', 'telefone', 'cep', 'aceite_em', 'criado_em', 'logradouro', 'numero', 'complemento', 'bairro', 'contato_preferido', 'melhor_horario', 'autoriza_calibracao',
] as const;

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

export interface EnderecoDaInstalacao {
  logradouro: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
}

export type DadosDoPedido = Pick<Cliente, 'nome' | 'email' | 'telefone'> & {
  codigoDaSimulacao: string;
  aceiteEm: Date;
  endereco?: EnderecoDaInstalacao;
  contatoPreferido?: ContatoPreferido;
  melhorHorario?: MelhorHorario;
  autorizaUsoParaCalibracao?: boolean;
};

export type ResultadoDoPedido = 'criado' | 'simulacao_nao_encontrada' | 'simulacao_ja_vinculada';

// Pedido de proposta: cria o cliente (com o CEP da simulação) e liga a simulação a ele, numa transação.
// A linha da simulação fica travada até o fim, então dois pedidos para a mesma simulação não criam dois clientes.
export async function registrarPedidoDeProposta(pedido: DadosDoPedido): Promise<ResultadoDoPedido> {
  return db.transaction(async (transacao) => {
    const simulacao = await transacao<Simulacao>('simulacao')
      .select('id', 'cep', 'cliente_id')
      .where({ codigo: pedido.codigoDaSimulacao })
      .forUpdate()
      .first();
    if (!simulacao) return 'simulacao_nao_encontrada';
    if (simulacao.cliente_id !== null) return 'simulacao_ja_vinculada';

    const [{ id }] = await transacao<Cliente>('cliente')
      .insert({
        nome: pedido.nome, email: pedido.email, telefone: pedido.telefone, cep: simulacao.cep, aceite_em: pedido.aceiteEm,
        logradouro: pedido.endereco?.logradouro ?? null, numero: pedido.endereco?.numero ?? null, complemento: pedido.endereco?.complemento ?? null, bairro: pedido.endereco?.bairro ?? null,
        contato_preferido: pedido.contatoPreferido ?? null, melhor_horario: pedido.melhorHorario ?? null, autoriza_calibracao: pedido.autorizaUsoParaCalibracao ?? false,
      })
      .returning('id');
    await transacao<Simulacao>('simulacao').where({ id: simulacao.id }).update({ cliente_id: id, atualizado_em: pedido.aceiteEm });
    return 'criado';
  });
}
