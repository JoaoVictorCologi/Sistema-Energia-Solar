import { db } from '../database/conexao.ts';
import type { Simulacao } from '../tipos/tabelas.ts';

export type SimulacaoParaGravar = Pick<Simulacao, 'cep' | 'codigo_ibge' | 'tarifa_id' | 'irradiacao_id' | 'versao_parametros' | 'entrada' | 'resultado'>;

// Devolve o código público da simulação.
export async function inserirSimulacao(simulacao: SimulacaoParaGravar): Promise<string> {
  // Os Decimal viram texto pelo toJSON: a entrada fica gravada com a precisão completa.
  const [{ codigo }] = await db<Simulacao>('simulacao')
    .insert({ ...simulacao, entrada: JSON.stringify(simulacao.entrada), resultado: JSON.stringify(simulacao.resultado) })
    .returning('codigo');
  return codigo;
}

export type SimulacaoDoCliente = Pick<Simulacao, 'id' | 'codigo' | 'criado_em' | 'resultado'>;

export async function listarSimulacoesDoCliente(clienteId: number): Promise<SimulacaoDoCliente[]> {
  return db<Simulacao>('simulacao').select('id', 'codigo', 'criado_em', 'resultado').where({ cliente_id: clienteId }).orderBy('criado_em', 'desc');
}

export type SimulacaoGravada = Pick<Simulacao, 'id' | 'cliente_id' | 'codigo_ibge' | 'entrada' | 'resultado'>;

export async function buscarSimulacaoPorCodigo(codigo: string): Promise<SimulacaoGravada | undefined> {
  return db<Simulacao>('simulacao').select('id', 'cliente_id', 'codigo_ibge', 'entrada', 'resultado').where({ codigo }).first();
}
