import { db } from '../database/conexao.ts';
import type { Distribuidora, Municipio, MunicipioDistribuidora } from '../tipos/tabelas.ts';

export interface VinculoParaGravar {
  codigoIbge: number;
  cnpj: string;
  // Sigla dos indicadores de qualidade: só vale para distribuidora nova (a importação de tarifas atualiza).
  sigla: string;
  conjuntos: number;
  sugerida: boolean;
}

export interface DistribuidoraDoMunicipio {
  id: number;
  cnpj: string;
  sigla: string;
  conjuntos: number;
  sugerida: boolean;
}

const LINHAS_POR_LOTE = 1_000;

async function idsPorCnpj(transacao: typeof db, vinculos: VinculoParaGravar[], agora: Date): Promise<Map<string, number>> {
  const novas = [...new Map(vinculos.map(({ cnpj, sigla }) => [cnpj, { cnpj, sigla, nome: sigla, atualizado_em: agora }])).values()];
  await transacao<Distribuidora>('distribuidora').insert(novas).onConflict('cnpj').ignore();
  const linhas = await transacao<Distribuidora>('distribuidora').select('id', 'cnpj').whereIn('cnpj', novas.map((nova) => nova.cnpj));
  return new Map(linhas.map((linha) => [linha.cnpj, linha.id]));
}

// Troca todos os vínculos de uma vez, numa transação: a fonte é a lista completa do país.
export async function substituirVinculos(vinculos: VinculoParaGravar[], importacaoId: number): Promise<void> {
  const agora = new Date();
  await db.transaction(async (transacao) => {
    const ids = await idsPorCnpj(transacao, vinculos, agora);
    await transacao<MunicipioDistribuidora>('municipio_distribuidora').del();
    const linhas = vinculos.map((vinculo) => ({
      codigo_ibge: vinculo.codigoIbge, distribuidora_id: ids.get(vinculo.cnpj)!, conjuntos: vinculo.conjuntos,
      sugerida: vinculo.sugerida, importacao_id: importacaoId, atualizado_em: agora,
    }));
    for (let inicio = 0; inicio < linhas.length; inicio += LINHAS_POR_LOTE) {
      await transacao<MunicipioDistribuidora>('municipio_distribuidora').insert(linhas.slice(inicio, inicio + LINHAS_POR_LOTE));
    }
  });
}

export async function listarDistribuidorasDoMunicipio(codigoIbge: number): Promise<DistribuidoraDoMunicipio[]> {
  return db<MunicipioDistribuidora>('municipio_distribuidora')
    .join('distribuidora', 'distribuidora.id', 'municipio_distribuidora.distribuidora_id')
    .where('municipio_distribuidora.codigo_ibge', codigoIbge)
    .select('distribuidora.id', 'distribuidora.cnpj', 'distribuidora.sigla', 'municipio_distribuidora.conjuntos', 'municipio_distribuidora.sugerida')
    .orderBy([{ column: 'municipio_distribuidora.conjuntos', order: 'desc' }, { column: 'distribuidora.sigla' }]);
}

// Para município sem dado na ANEEL: as distribuidoras que atendem algum município da UF.
export async function listarDistribuidorasDaUf(uf: string): Promise<Pick<DistribuidoraDoMunicipio, 'id' | 'cnpj' | 'sigla'>[]> {
  return db<MunicipioDistribuidora>('municipio_distribuidora')
    .join('distribuidora', 'distribuidora.id', 'municipio_distribuidora.distribuidora_id')
    .join<Municipio>('municipio', 'municipio.codigo_ibge', 'municipio_distribuidora.codigo_ibge')
    .where('municipio.uf', uf)
    .distinct('distribuidora.id', 'distribuidora.cnpj', 'distribuidora.sigla')
    .orderBy('distribuidora.sigla');
}

// CNPJs de todas as distribuidoras ligadas a algum município: são as que a importação de tarifas precisa cobrir.
export async function listarCnpjsLigados(): Promise<string[]> {
  const linhas = await db<MunicipioDistribuidora>('municipio_distribuidora')
    .join('distribuidora', 'distribuidora.id', 'municipio_distribuidora.distribuidora_id')
    .distinct('distribuidora.cnpj');
  return linhas.map((linha: { cnpj: string }) => linha.cnpj);
}
