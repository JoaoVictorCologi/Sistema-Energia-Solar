// Simulações gravadas: o pedido, a entrada do motor e o resultado, em JSONB.
import type { Knex } from 'knex';
import { db } from '../database/conexao.ts';
import type { Simulacao } from '../tipos/tabelas.ts';
import { comoTrechoDoLike } from '../utils/busca.ts';

export type SimulacaoParaGravar = Pick<Simulacao, 'cep' | 'codigo_ibge' | 'tarifa_id' | 'irradiacao_id' | 'versao_parametros' | 'entrada' | 'resultado'>;

// Devolve o código público da simulação.
export async function inserirSimulacao(simulacao: SimulacaoParaGravar): Promise<string> {
  // Os Decimal viram texto pelo toJSON: a entrada fica gravada com a precisão completa.
  const [{ codigo }] = await db<Simulacao>('simulacao')
    .insert({ ...simulacao, entrada: JSON.stringify(simulacao.entrada), resultado: JSON.stringify(simulacao.resultado) })
    .returning('codigo');
  return codigo;
}

export type SimulacaoDoCliente = Pick<Simulacao, 'id' | 'codigo' | 'criado_em' | 'resultado' | 'entrada'>;

export async function listarSimulacoesDoCliente(clienteId: number): Promise<SimulacaoDoCliente[]> {
  return db<Simulacao>('simulacao').select('id', 'codigo', 'criado_em', 'resultado', 'entrada').where({ cliente_id: clienteId }).orderBy('criado_em', 'desc');
}

export interface FiltroDeSimulacoes {
  // 'AAAA-MM-DD', dias inteiros no fuso de São Paulo (sem horário de verão desde 2019).
  de?: string;
  ate?: string;
  cidade?: string;
  comPedido?: boolean;
  pagina: number;
  porPagina: number;
}

export interface SimulacaoDaLista extends Pick<Simulacao, 'codigo' | 'criado_em' | 'resultado' | 'cliente_id'> {
  cidade: string;
  uf: string;
  cliente_nome: string | null;
}

function filtrarSimulacoes(consulta: Knex.QueryBuilder, { de, ate, cidade, comPedido }: FiltroDeSimulacoes): void {
  if (de) consulta.where('simulacao.criado_em', '>=', `${de}T00:00:00-03:00`);
  if (ate) consulta.where('simulacao.criado_em', '<=', `${ate}T23:59:59.999-03:00`);
  if (cidade) consulta.whereILike('municipio.nome', comoTrechoDoLike(cidade));
  if (comPedido === true) consulta.whereNotNull('simulacao.cliente_id');
  if (comPedido === false) consulta.whereNull('simulacao.cliente_id');
}

export async function listarSimulacoes(filtro: FiltroDeSimulacoes): Promise<{ simulacoes: SimulacaoDaLista[]; total: number }> {
  const comMunicipio = () => db<Simulacao>('simulacao').join('municipio', 'municipio.codigo_ibge', 'simulacao.codigo_ibge').modify(filtrarSimulacoes, filtro);
  const [simulacoes, contagem] = await Promise.all([
    comMunicipio().leftJoin('cliente', 'cliente.id', 'simulacao.cliente_id')
      .select('simulacao.codigo', 'simulacao.criado_em', 'simulacao.resultado', 'simulacao.cliente_id', 'municipio.nome as cidade', 'municipio.uf', 'cliente.nome as cliente_nome')
      .orderBy('simulacao.criado_em', 'desc').orderBy('simulacao.id', 'desc')
      .limit(filtro.porPagina).offset((filtro.pagina - 1) * filtro.porPagina),
    comMunicipio().count<{ total: string }[]>({ total: '*' }),
  ]);
  return { simulacoes: simulacoes as SimulacaoDaLista[], total: Number(contagem[0].total) };
}

export type SimulacaoGravada = Pick<Simulacao, 'id' | 'cliente_id' | 'codigo_ibge' | 'entrada' | 'resultado'>;

export async function buscarSimulacaoPorCodigo(codigo: string): Promise<SimulacaoGravada | undefined> {
  return db<Simulacao>('simulacao').select('id', 'cliente_id', 'codigo_ibge', 'entrada', 'resultado').where({ codigo }).first();
}

export async function buscarSimulacaoPorId(id: number): Promise<SimulacaoGravada | undefined> {
  return db<Simulacao>('simulacao').select('id', 'cliente_id', 'codigo_ibge', 'entrada', 'resultado').where({ id }).first();
}
