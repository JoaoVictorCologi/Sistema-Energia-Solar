import { Decimal } from 'decimal.js';
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

export interface GravacaoDeTarifas {
  distribuidora: { sigla: string; cnpj: string };
  novas: DadosDaTarifa[];
  alteradas: TarifaGravada[];
  importacaoId: number;
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

export async function listarTarifasDaDistribuidora(sigla: string): Promise<TarifaGravada[]> {
  const linhas = await db<Tarifa>('tarifa')
    .join('distribuidora', 'distribuidora.id', 'tarifa.distribuidora_id')
    .where('distribuidora.sigla', sigla)
    .select(...COLUNAS_DA_TARIFA);
  return linhas.map(comoTarifa);
}

// Tudo numa transação: se qualquer parte falhar, nenhuma tarifa muda.
export async function gravarTarifas({ distribuidora, novas, alteradas, importacaoId }: GravacaoDeTarifas): Promise<void> {
  const agora = new Date();
  await db.transaction(async (transacao) => {
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
  });
}

export interface FiltroDeTarifa {
  sigla: string;
  subgrupo: string;
  classe: string;
  subclasse: string;
  // 'AAAA-MM-DD': a tarifa vigente nessa data (ou, se a vigência venceu sem tarifa nova, a mais recente).
  data: string;
}

export async function buscarTarifaVigente({ sigla, subgrupo, classe, subclasse, data }: FiltroDeTarifa): Promise<TarifaGravada | undefined> {
  const linha = await db<Tarifa>('tarifa')
    .join('distribuidora', 'distribuidora.id', 'tarifa.distribuidora_id')
    .where({ 'distribuidora.sigla': sigla, 'tarifa.subgrupo': subgrupo, 'tarifa.modalidade': 'Convencional', 'tarifa.classe': classe, 'tarifa.subclasse': subclasse })
    .where('tarifa.inicio_vigencia', '<=', data)
    .orderBy('tarifa.inicio_vigencia', 'desc')
    .select(...COLUNAS_DA_TARIFA)
    .first();
  return linha && comoTarifa(linha);
}
