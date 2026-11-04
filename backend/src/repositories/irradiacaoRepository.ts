// Irradiação por município, em horas de sol pleno (HSP) por dia.
import { Decimal } from 'decimal.js';
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

// Lotes de 1.000 linhas (15 colunas cada): o PostgreSQL aceita no máximo 65.535 parâmetros por consulta.
const LINHAS_POR_LOTE = 1_000;

// Recarregar o Atlas substitui os valores do município (o código IBGE é a chave). Tudo ou nada, numa transação.
export async function salvarIrradiacoes(irradiacoes: IrradiacaoParaGravar[]): Promise<void> {
  if (irradiacoes.length === 0) return;
  const agora = new Date();
  await db.transaction(async (transacao) => {
    for (let inicio = 0; inicio < irradiacoes.length; inicio += LINHAS_POR_LOTE) {
      await transacao<IrradiacaoMunicipio>('irradiacao_municipio')
        .insert(irradiacoes.slice(inicio, inicio + LINHAS_POR_LOTE).map((irradiacao) => comoLinha(irradiacao, agora)))
        .onConflict('codigo_ibge')
        .merge(['hsp_anual', ...COLUNAS_DOS_MESES, 'atualizado_em']);
    }
  });
}

export interface IrradiacaoGravada {
  id: number;
  hspAnual: Decimal;
  hspMensal: Decimal[];
}

export async function buscarIrradiacaoDoMunicipio(codigoIbge: number): Promise<IrradiacaoGravada | undefined> {
  const linha = await db<IrradiacaoMunicipio>('irradiacao_municipio')
    .select('id', 'hsp_anual', ...COLUNAS_DOS_MESES)
    .where({ codigo_ibge: codigoIbge })
    .first();
  if (!linha) return undefined;
  return { id: linha.id, hspAnual: new Decimal(linha.hsp_anual), hspMensal: COLUNAS_DOS_MESES.map((coluna) => new Decimal(linha[coluna])) };
}
