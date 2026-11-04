// Catálogo de módulos e inversores com preço.
import { Decimal } from 'decimal.js';
import type { Knex } from 'knex';
import { db } from '../database/conexao.ts';
import type { Equipamento, TipoDeEquipamento } from '../tipos/tabelas.ts';

export interface EquipamentoDoCatalogo {
  id: number;
  tipo: TipoDeEquipamento;
  fabricante: string;
  modelo: string;
  potenciaW: Decimal;
  degradacaoAnual: Decimal | null;
  preco: Decimal;
  ativo: boolean;
}

export type DadosDoEquipamento = Omit<EquipamentoDoCatalogo, 'id' | 'ativo'>;

const COLUNAS = ['id', 'tipo', 'fabricante', 'modelo', 'potencia_w', 'degradacao_anual', 'preco', 'ativo'] as const;
// Violação de chave única no PostgreSQL.
const CODIGO_DE_DUPLICADO = '23505';

function comoEquipamento(linha: Pick<Equipamento, (typeof COLUNAS)[number]>): EquipamentoDoCatalogo {
  return {
    id: linha.id, tipo: linha.tipo, fabricante: linha.fabricante, modelo: linha.modelo,
    potenciaW: new Decimal(linha.potencia_w), degradacaoAnual: linha.degradacao_anual === null ? null : new Decimal(linha.degradacao_anual),
    preco: new Decimal(linha.preco), ativo: linha.ativo,
  };
}

export async function listarEquipamentos(tipo?: TipoDeEquipamento): Promise<EquipamentoDoCatalogo[]> {
  const consulta = db<Equipamento>('equipamento').select(...COLUNAS).orderBy([{ column: 'tipo' }, { column: 'potencia_w' }, { column: 'id' }]);
  if (tipo) consulta.where({ tipo });
  return (await consulta).map(comoEquipamento);
}

// Devolve null se já existe um equipamento com o mesmo tipo, fabricante e modelo.
export async function inserirEquipamento(dados: DadosDoEquipamento): Promise<EquipamentoDoCatalogo | null> {
  try {
    const [linha] = await db<Equipamento>('equipamento').insert({
      tipo: dados.tipo, fabricante: dados.fabricante, modelo: dados.modelo, potencia_w: dados.potenciaW.toString(),
      degradacao_anual: dados.degradacaoAnual?.toString() ?? null, preco: dados.preco.toString(),
    }).returning([...COLUNAS]);
    return comoEquipamento(linha);
  } catch (erro) {
    if ((erro as { code?: string }).code === CODIGO_DE_DUPLICADO) return null;
    throw erro;
  }
}

export async function atualizarEquipamento(id: number, mudanca: { preco?: Decimal; ativo?: boolean }): Promise<EquipamentoDoCatalogo | undefined> {
  const [linha] = await db<Equipamento>('equipamento')
    .where({ id })
    .update({ ...(mudanca.preco && { preco: mudanca.preco.toString() }), ...(mudanca.ativo !== undefined && { ativo: mudanca.ativo }), atualizado_em: new Date() })
    .returning([...COLUNAS]);
  return linha && comoEquipamento(linha);
}

// Dentro da transação da proposta: trava as linhas para o preço não mudar entre o cálculo e a gravação.
export async function buscarEquipamentosAtivos(transacao: Knex.Transaction, ids: number[]): Promise<EquipamentoDoCatalogo[]> {
  const linhas = await transacao<Equipamento>('equipamento').select(...COLUNAS).whereIn('id', ids).where({ ativo: true }).forShare();
  return linhas.map(comoEquipamento);
}
