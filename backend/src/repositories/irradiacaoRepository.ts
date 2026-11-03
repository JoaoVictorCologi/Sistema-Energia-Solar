import type { Decimal } from 'decimal.js';
import { db } from '../database/conexao.ts';
import type { IrradiacaoMunicipio } from '../tipos/tabelas.ts';

export const COLUNAS_DOS_MESES = [
  'hsp_jan', 'hsp_fev', 'hsp_mar', 'hsp_abr', 'hsp_mai', 'hsp_jun',
  'hsp_jul', 'hsp_ago', 'hsp_set', 'hsp_out', 'hsp_nov', 'hsp_dez',
] as const;

export interface IrradiacaoParaGravar {
  codigoIbge: number;
  hspAnual: Decimal;
  // 12 valores, de janeiro a dezembro.
  hspMensal: Decimal[];
}

function comoLinha({ codigoIbge, hspAnual, hspMensal }: IrradiacaoParaGravar, agora: Date) {
  const meses = Object.fromEntries(COLUNAS_DOS_MESES.map((coluna, indice) => [coluna, hspMensal[indice].toString()]));
  return { codigo_ibge: codigoIbge, hsp_anual: hspAnual.toString(), ...meses, atualizado_em: agora };
}

// Recarregar o Atlas substitui os valores do município (o código IBGE é a chave).
export async function salvarIrradiacoes(irradiacoes: IrradiacaoParaGravar[]): Promise<void> {
  if (irradiacoes.length === 0) return;
  const agora = new Date();
  await db<IrradiacaoMunicipio>('irradiacao_municipio')
    .insert(irradiacoes.map((irradiacao) => comoLinha(irradiacao, agora)))
    .onConflict('codigo_ibge')
    .merge(['hsp_anual', ...COLUNAS_DOS_MESES, 'atualizado_em']);
}
