import { Decimal } from 'decimal.js';
import { db } from '../database/conexao.ts';
import type { IndicadorEconomico } from '../tipos/tabelas.ts';

export interface IndicadorParaGravar {
  serie: number;
  data: string;
  valor: Decimal;
}

export async function buscarUltimaDataDaSerie(serie: number): Promise<string | null> {
  const ultima = await db<IndicadorEconomico>('indicador_economico').select('data').where({ serie }).orderBy('data', 'desc').first();
  return ultima?.data ?? null;
}

// Valor já gravado (mesma série e data) não é sobrescrito. Devolve quantas linhas entraram.
export async function gravarIndicadores(indicadores: IndicadorParaGravar[], importacaoId: number): Promise<number> {
  if (indicadores.length === 0) return 0;
  const linhas = indicadores.map(({ serie, data, valor }) => ({ serie, data, valor: valor.toString(), importacao_id: importacaoId }));
  const inseridas = await db<IndicadorEconomico>('indicador_economico').insert(linhas).onConflict(['serie', 'data']).ignore().returning('id');
  return inseridas.length;
}

export async function buscarUltimoIndicador(serie: number): Promise<{ data: string; valor: Decimal } | undefined> {
  const linha = await db<IndicadorEconomico>('indicador_economico').select('data', 'valor').where({ serie }).orderBy('data', 'desc').first();
  return linha && { data: linha.data, valor: new Decimal(linha.valor) };
}
