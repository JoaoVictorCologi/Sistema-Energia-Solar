// Configuração comercial e formas de pagamento.
import { Decimal } from 'decimal.js';
import { db } from '../database/conexao.ts';
import type { ConfiguracaoComercial, FormaPagamento, TipoDePagamento } from '../tipos/tabelas.ts';

export interface ConfiguracaoVigente {
  margem: Decimal;
  instalacaoPorKwp: Decimal;
  custoReferenciaPorKwp: Decimal;
  validadeDias: number;
  limiteDesconto: Decimal;
  alteradoEm: Date;
}

export interface FormaDePagamento {
  id: number;
  tipo: TipoDePagamento;
  nome: string;
  taxaMensal: Decimal | null;
  parcelasMinimas: number;
  parcelasMaximas: number;
  entradaMinima: Decimal;
  carenciaMaximaDias: number;
  descontoAvista: Decimal;
  ativa: boolean;
}

export type DadosDaForma = Omit<FormaDePagamento, 'id'>;

const COLUNAS_DA_FORMA = [
  'id', 'tipo', 'nome', 'taxa_mensal', 'parcelas_minimas', 'parcelas_maximas', 'entrada_minima', 'carencia_maxima_dias', 'desconto_avista', 'ativa',
] as const;
// Violação de chave única no PostgreSQL.
const CODIGO_DE_DUPLICADO = '23505';

function comoForma(linha: Pick<FormaPagamento, (typeof COLUNAS_DA_FORMA)[number]>): FormaDePagamento {
  return {
    id: linha.id, tipo: linha.tipo, nome: linha.nome, taxaMensal: linha.taxa_mensal === null ? null : new Decimal(linha.taxa_mensal),
    parcelasMinimas: linha.parcelas_minimas, parcelasMaximas: linha.parcelas_maximas, entradaMinima: new Decimal(linha.entrada_minima),
    carenciaMaximaDias: linha.carencia_maxima_dias, descontoAvista: new Decimal(linha.desconto_avista), ativa: linha.ativa,
  };
}

function comoLinhaDaForma(dados: DadosDaForma, usuarioId: number | null) {
  return {
    tipo: dados.tipo, nome: dados.nome, taxa_mensal: dados.taxaMensal?.toString() ?? null, parcelas_minimas: dados.parcelasMinimas,
    parcelas_maximas: dados.parcelasMaximas, entrada_minima: dados.entradaMinima.toString(), carencia_maxima_dias: dados.carenciaMaximaDias,
    desconto_avista: dados.descontoAvista.toString(), ativa: dados.ativa, alterado_por: usuarioId, atualizado_em: new Date(),
  };
}

// A mais recente vale; as anteriores ficam como histórico das alterações.
export async function buscarConfiguracaoComercial(): Promise<ConfiguracaoVigente | undefined> {
  const linha = await db<ConfiguracaoComercial>('configuracao_comercial')
    .select('margem', 'instalacao_por_kwp', 'custo_referencia_por_kwp', 'validade_dias', 'limite_desconto', 'criado_em')
    .orderBy('id', 'desc')
    .first();
  return linha && {
    margem: new Decimal(linha.margem), instalacaoPorKwp: new Decimal(linha.instalacao_por_kwp), custoReferenciaPorKwp: new Decimal(linha.custo_referencia_por_kwp),
    validadeDias: linha.validade_dias, limiteDesconto: new Decimal(linha.limite_desconto), alteradoEm: linha.criado_em,
  };
}

export async function registrarConfiguracaoComercial(dados: Omit<ConfiguracaoVigente, 'alteradoEm'>, usuarioId: number): Promise<void> {
  await db<ConfiguracaoComercial>('configuracao_comercial').insert({
    margem: dados.margem.toString(), instalacao_por_kwp: dados.instalacaoPorKwp.toString(), custo_referencia_por_kwp: dados.custoReferenciaPorKwp.toString(),
    validade_dias: dados.validadeDias, limite_desconto: dados.limiteDesconto.toString(), alterado_por: usuarioId,
  });
}

export async function listarFormasDePagamento(somenteAtivas = false): Promise<FormaDePagamento[]> {
  const consulta = db<FormaPagamento>('forma_pagamento').select(...COLUNAS_DA_FORMA).orderBy('id');
  if (somenteAtivas) consulta.where({ ativa: true });
  return (await consulta).map(comoForma);
}

export async function buscarFormaDePagamento(id: number): Promise<FormaDePagamento | undefined> {
  const linha = await db<FormaPagamento>('forma_pagamento').select(...COLUNAS_DA_FORMA).where({ id }).first();
  return linha && comoForma(linha);
}

// Devolve null se o nome já existe.
export async function inserirFormaDePagamento(dados: DadosDaForma, usuarioId: number): Promise<FormaDePagamento | null> {
  try {
    const [linha] = await db<FormaPagamento>('forma_pagamento').insert(comoLinhaDaForma(dados, usuarioId)).returning([...COLUNAS_DA_FORMA]);
    return comoForma(linha);
  } catch (erro) {
    if ((erro as { code?: string }).code === CODIGO_DE_DUPLICADO) return null;
    throw erro;
  }
}

// Devolve null se o nome novo já existe em outra forma.
export async function atualizarFormaDePagamento(id: number, dados: DadosDaForma, usuarioId: number): Promise<FormaDePagamento | null> {
  try {
    const [linha] = await db<FormaPagamento>('forma_pagamento').where({ id }).update(comoLinhaDaForma(dados, usuarioId)).returning([...COLUNAS_DA_FORMA]);
    return comoForma(linha);
  } catch (erro) {
    if ((erro as { code?: string }).code === CODIGO_DE_DUPLICADO) return null;
    throw erro;
  }
}
