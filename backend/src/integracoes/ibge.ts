// IBGE Localidades: lista de municípios de uma UF (só a UF atendida, nunca o país inteiro).
import { z } from 'zod';
import { buscarJson, ErroDeIntegracao } from './http.ts';

const URL_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';

const esquemaResposta = z.array(z.object({
  id: z.number().int().min(1_000_000).max(9_999_999),
  nome: z.string().min(1),
}));

export interface MunicipioDoIbge {
  codigoIbge: number;
  nome: string;
  uf: string;
}

export async function buscarMunicipiosDaUf(uf: string): Promise<MunicipioDoIbge[]> {
  const resposta = await buscarJson(`${URL_BASE}/estados/${encodeURIComponent(uf)}/municipios`);
  const resultado = esquemaResposta.safeParse(resposta);
  if (!resultado.success) throw new ErroDeIntegracao('O IBGE devolveu municípios num formato inesperado.');
  return resultado.data.map(({ id, nome }) => ({ codigoIbge: id, nome, uf }));
}
