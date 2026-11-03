import { db } from '../database/conexao.ts';
import type { Municipio } from '../tipos/tabelas.ts';

export interface MunicipioParaGravar {
  codigoIbge: number;
  nome: string;
  uf: string;
}

// Rodar a carga de novo só atualiza nome e UF: o código IBGE é a chave.
export async function salvarMunicipios(municipios: MunicipioParaGravar[]): Promise<void> {
  if (municipios.length === 0) return;
  const agora = new Date();
  const linhas = municipios.map(({ codigoIbge, nome, uf }) => ({ codigo_ibge: codigoIbge, nome, uf, atualizado_em: agora }));
  await db<Municipio>('municipio').insert(linhas).onConflict('codigo_ibge').merge(['nome', 'uf', 'atualizado_em']);
}

export async function listarMunicipiosDaUf(uf: string): Promise<MunicipioParaGravar[]> {
  const linhas = await db<Municipio>('municipio').select('codigo_ibge', 'nome', 'uf').where({ uf }).orderBy('nome');
  return linhas.map((linha) => ({ codigoIbge: linha.codigo_ibge, nome: linha.nome, uf: linha.uf }));
}

export async function buscarMunicipio(codigoIbge: number): Promise<MunicipioParaGravar | undefined> {
  const linha = await db<Municipio>('municipio').select('codigo_ibge', 'nome', 'uf').where({ codigo_ibge: codigoIbge }).first();
  return linha && { codigoIbge: linha.codigo_ibge, nome: linha.nome, uf: linha.uf };
}
