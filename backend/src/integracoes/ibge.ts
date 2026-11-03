// IBGE Localidades: lista de municípios do Brasil (cobertura nacional, Plano 5).
import { z } from 'zod';
import { buscarJson, ErroDeIntegracao } from './http.ts';

const URL_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';

// Visão "nivelada": código, nome e UF no mesmo nível (na visão normal, município novo pode vir sem microrregião).
const esquemaResposta = z.array(z.object({
  'municipio-id': z.number().int().min(1_000_000).max(9_999_999),
  'municipio-nome': z.string().min(1),
  'UF-sigla': z.string().regex(/^[A-Z]{2}$/),
}));

export interface MunicipioDoIbge {
  codigoIbge: number;
  nome: string;
  uf: string;
}

// Os 5.571 municípios numa chamada (cerca de 2 MB): é a lista que o sistema precisa, não uma base para filtrar.
export async function buscarMunicipiosDoBrasil(): Promise<MunicipioDoIbge[]> {
  const resposta = await buscarJson(`${URL_BASE}/municipios?view=nivelado`, { timeoutMs: 30_000 });
  const resultado = esquemaResposta.safeParse(resposta);
  if (!resultado.success) throw new ErroDeIntegracao('O IBGE devolveu municípios num formato inesperado.');
  return resultado.data.map((municipio) => ({ codigoIbge: municipio['municipio-id'], nome: municipio['municipio-nome'], uf: municipio['UF-sigla'] }));
}
