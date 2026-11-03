import { db } from '../database/conexao.ts';
import type { CepCache } from '../tipos/tabelas.ts';

export async function buscarCodigoIbgeDoCep(cep: string): Promise<number | undefined> {
  const linha = await db<CepCache>('cep_cache').select('codigo_ibge').where({ cep }).first();
  return linha?.codigo_ibge;
}

export async function salvarCepNoCache(cep: string, codigoIbge: number): Promise<void> {
  await db<CepCache>('cep_cache')
    .insert({ cep, codigo_ibge: codigoIbge, atualizado_em: new Date() })
    .onConflict('cep')
    .merge(['codigo_ibge', 'atualizado_em']);
}
