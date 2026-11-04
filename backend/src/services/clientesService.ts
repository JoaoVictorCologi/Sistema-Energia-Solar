// Pedido de proposta: traduz o resultado da gravação nos erros da API.
import { ErroHttp } from '../middlewares/erros.ts';
import { registrarPedidoDeProposta, type EnderecoDaInstalacao } from '../repositories/clientesRepository.ts';
import type { ContatoPreferido, MelhorHorario } from '../tipos/tabelas.ts';

export interface PedidoDeProposta {
  codigoDaSimulacao: string;
  nome: string;
  email: string;
  telefone: string;
  endereco?: EnderecoDaInstalacao;
  contatoPreferido?: ContatoPreferido;
  melhorHorario?: MelhorHorario;
  autorizaUsoParaCalibracao?: boolean;
}

// Cada pedido cria um cliente novo: um pedido público nunca altera dados de um cliente já gravado.
export async function pedirProposta(pedido: PedidoDeProposta, agora = new Date()): Promise<void> {
  const resultado = await registrarPedidoDeProposta({ ...pedido, aceiteEm: agora });
  if (resultado === 'simulacao_nao_encontrada') {
    throw new ErroHttp(404, 'SIMULACAO_NAO_ENCONTRADA', 'Simulação não encontrada. Faça a simulação de novo.');
  }
  if (resultado === 'simulacao_ja_vinculada') {
    throw new ErroHttp(409, 'PEDIDO_JA_ENVIADO', 'O pedido de proposta desta simulação já foi enviado.');
  }
}
