import { ErroHttp } from '../middlewares/erros.ts';
import {
  atualizarEquipamento, inserirEquipamento, listarEquipamentos, type DadosDoEquipamento, type EquipamentoDoCatalogo,
} from '../repositories/equipamentosRepository.ts';
import type { TipoDeEquipamento } from '../tipos/tabelas.ts';
import type { Decimal } from 'decimal.js';

export function comoEquipamentoDaApi(equipamento: EquipamentoDoCatalogo) {
  return {
    id: equipamento.id, tipo: equipamento.tipo, fabricante: equipamento.fabricante, modelo: equipamento.modelo,
    potenciaW: equipamento.potenciaW.toNumber(), degradacaoAnual: equipamento.degradacaoAnual?.toNumber() ?? null,
    preco: equipamento.preco.toNumber(), ativo: equipamento.ativo,
  };
}

export async function consultarCatalogo(tipo?: TipoDeEquipamento) {
  return (await listarEquipamentos(tipo)).map(comoEquipamentoDaApi);
}

export async function cadastrarEquipamento(dados: DadosDoEquipamento) {
  const equipamento = await inserirEquipamento(dados);
  if (!equipamento) throw new ErroHttp(409, 'EQUIPAMENTO_DUPLICADO', 'Já existe um equipamento com este tipo, fabricante e modelo.');
  return comoEquipamentoDaApi(equipamento);
}

// Preço novo vale só para as próximas propostas: as já gravadas guardam o preço da data.
export async function alterarEquipamento(id: number, mudanca: { preco?: Decimal; ativo?: boolean }) {
  const equipamento = await atualizarEquipamento(id, mudanca);
  if (!equipamento) throw new ErroHttp(404, 'EQUIPAMENTO_NAO_ENCONTRADO', 'Equipamento não encontrado.');
  return comoEquipamentoDaApi(equipamento);
}
