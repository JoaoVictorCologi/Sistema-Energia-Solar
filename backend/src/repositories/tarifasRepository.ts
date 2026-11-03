import { Decimal } from 'decimal.js';
import type { Knex } from 'knex';
import { db } from '../database/conexao.ts';
import type { Distribuidora, Tarifa } from '../tipos/tabelas.ts';

export interface DadosDaTarifa {
  subgrupo: string;
  modalidade: string;
  classe: string;
  subclasse: string;
  // Reais por kWh, sem impostos.
  te: Decimal;
  tusd: Decimal;
  fioB: Decimal | null;
  inicioVigencia: string;
  fimVigencia: string | null;
}

export interface TarifaGravada extends DadosDaTarifa {
  id: number;
}

export interface GravacaoDaDistribuidora {
  distribuidora: { sigla: string; cnpj: string };
  novas: DadosDaTarifa[];
  alteradas: TarifaGravada[];
}

const COLUNAS_DA_TARIFA = [
  'tarifa.id', 'tarifa.subgrupo', 'tarifa.modalidade', 'tarifa.classe', 'tarifa.subclasse', 'tarifa.te_rs_kwh',
  'tarifa.tusd_rs_kwh', 'tarifa.fio_b_rs_kwh', 'tarifa.inicio_vigencia', 'tarifa.fim_vigencia',
];

function comoTarifa(linha: Tarifa): TarifaGravada {
  return {
    id: linha.id,
    subgrupo: linha.subgrupo,
    modalidade: linha.modalidade,
    classe: linha.classe,
    subclasse: linha.subclasse,
    te: new Decimal(linha.te_rs_kwh),
    tusd: new Decimal(linha.tusd_rs_kwh),
    fioB: linha.fio_b_rs_kwh === null ? null : new Decimal(linha.fio_b_rs_kwh),
    inicioVigencia: linha.inicio_vigencia,
    fimVigencia: linha.fim_vigencia,
  };
}

function comoLinha(tarifa: DadosDaTarifa, importacaoId: number, agora: Date) {
  return {
    subgrupo: tarifa.subgrupo,
    modalidade: tarifa.modalidade,
    classe: tarifa.classe,
    subclasse: tarifa.subclasse,
    te_rs_kwh: tarifa.te.toString(),
    tusd_rs_kwh: tarifa.tusd.toString(),
    fio_b_rs_kwh: tarifa.fioB?.toString() ?? null,
    inicio_vigencia: tarifa.inicioVigencia,
    fim_vigencia: tarifa.fimVigencia,
    importacao_id: importacaoId,
    atualizado_em: agora,
  };
}

// Tarifas já gravadas, agrupadas pelo CNPJ da distribuidora: a importação compara com o que chegou.
export async function listarTarifasPorCnpj(): Promise<Map<string, TarifaGravada[]>> {
  const linhas = await db<Tarifa>('tarifa')
    .join('distribuidora', 'distribuidora.id', 'tarifa.distribuidora_id')
    .select(...COLUNAS_DA_TARIFA, 'distribuidora.cnpj');
  const porCnpj = new Map<string, TarifaGravada[]>();
  for (const linha of linhas as (Tarifa & { cnpj: string })[]) porCnpj.set(linha.cnpj, [...(porCnpj.get(linha.cnpj) ?? []), comoTarifa(linha)]);
  return porCnpj;
}

// Todas as distribuidoras numa transação: se qualquer parte falhar, nenhuma tarifa muda.
export async function gravarTarifas(gravacoes: GravacaoDaDistribuidora[], importacaoId: number): Promise<void> {
  const agora = new Date();
  await db.transaction(async (transacao) => {
    for (const { distribuidora, novas, alteradas } of gravacoes) {
      const [{ id: distribuidoraId }] = await transacao<Distribuidora>('distribuidora')
        .insert({ sigla: distribuidora.sigla, cnpj: distribuidora.cnpj, nome: distribuidora.sigla, atualizado_em: agora })
        // O CNPJ é a chave; a sigla e o nome seguem a vigência mais recente.
        .onConflict('cnpj')
        .merge(['sigla', 'nome', 'atualizado_em'])
        .returning('id');
      if (novas.length > 0) {
        await transacao<Tarifa>('tarifa').insert(novas.map((tarifa) => ({ ...comoLinha(tarifa, importacaoId, agora), distribuidora_id: distribuidoraId })));
      }
      for (const tarifa of alteradas) {
        await transacao<Tarifa>('tarifa').where({ id: tarifa.id }).update(comoLinha(tarifa, importacaoId, agora));
      }
    }
  });
}

export interface FiltroDeTarifa {
  cnpj: string;
  subgrupo: string;
  classe: string;
  subclasse: string;
  // 'AAAA-MM-DD': a tarifa vigente nessa data (ou, se a vigência venceu sem tarifa nova, a mais recente).
  data: string;
}

function daDistribuidora(consulta: Knex.QueryBuilder, { cnpj, subgrupo, classe, subclasse }: Omit<FiltroDeTarifa, 'data'>): void {
  consulta
    .join('distribuidora', 'distribuidora.id', 'tarifa.distribuidora_id')
    .where({ 'distribuidora.cnpj': cnpj, 'tarifa.subgrupo': subgrupo, 'tarifa.modalidade': 'Convencional', 'tarifa.classe': classe, 'tarifa.subclasse': subclasse });
}

export async function buscarTarifaVigente(filtro: FiltroDeTarifa): Promise<TarifaGravada | undefined> {
  const linha = await db<Tarifa>('tarifa').modify(daDistribuidora, filtro)
    .where('tarifa.inicio_vigencia', '<=', filtro.data)
    .orderBy('tarifa.inicio_vigencia', 'desc')
    .select(...COLUNAS_DA_TARIFA)
    .first();
  return linha && comoTarifa(linha);
}

// A vigência mais recente, anterior à data, que tem Fio B publicado (a ANEEL não publica o componente todo ano).
export async function buscarUltimaTarifaComFioB(filtro: FiltroDeTarifa): Promise<TarifaGravada | undefined> {
  const linha = await db<Tarifa>('tarifa').modify(daDistribuidora, filtro)
    .where('tarifa.inicio_vigencia', '<', filtro.data)
    .whereNotNull('tarifa.fio_b_rs_kwh')
    .orderBy('tarifa.inicio_vigencia', 'desc')
    .select(...COLUNAS_DA_TARIFA)
    .first();
  return linha && comoTarifa(linha);
}

// Distribuidoras que podem ser escolhidas: com tarifa vigente ou vencida há pouco (sem tarifa nova importada ainda).
export async function listarCnpjsComTarifaDesde(data: string): Promise<Set<string>> {
  const linhas = await db<Tarifa>('tarifa')
    .join('distribuidora', 'distribuidora.id', 'tarifa.distribuidora_id')
    .where((condicao) => condicao.whereNull('tarifa.fim_vigencia').orWhere('tarifa.fim_vigencia', '>=', data))
    .distinct('distribuidora.cnpj');
  return new Set(linhas.map((linha: { cnpj: string }) => linha.cnpj));
}
