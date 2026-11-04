// Registro de cada execução das importações. A linha "executando" também serve de trava contra execuções simultâneas.
import { db } from '../database/conexao.ts';
import type { Importacao, StatusDaImportacao } from '../tipos/tabelas.ts';

export type ImportacaoResumo = Pick<Importacao,
  'id' | 'tipo' | 'status' | 'iniciada_em' | 'finalizada_em' | 'versao_da_fonte' | 'linhas_gravadas' | 'mensagem'>;

export interface FimDaImportacao {
  status: Exclude<StatusDaImportacao, 'executando'>;
  linhasGravadas: number;
  versaoDaFonte: string | null;
  mensagem: string | null;
}

const COLUNAS = ['id', 'tipo', 'status', 'iniciada_em', 'finalizada_em', 'versao_da_fonte', 'linhas_gravadas', 'mensagem'] as const;

export async function iniciarImportacao(tipo: string, agora: Date): Promise<number> {
  const [{ id }] = await db<Importacao>('importacao').insert({ tipo, status: 'executando', iniciada_em: agora }).returning('id');
  return id;
}

export async function finalizarImportacao(id: number, fim: FimDaImportacao, agora: Date): Promise<ImportacaoResumo> {
  const [importacao] = await db<Importacao>('importacao')
    .where({ id })
    .update({
      status: fim.status,
      linhas_gravadas: fim.linhasGravadas,
      versao_da_fonte: fim.versaoDaFonte,
      mensagem: fim.mensagem,
      finalizada_em: agora,
      atualizado_em: agora,
    })
    .returning([...COLUNAS]);
  return importacao;
}

// Só conta execução recente: uma antiga sem fim, de um servidor reiniciado no meio, não bloqueia para sempre.
export async function existeImportacaoEmAndamento(tipo: string, iniciadaDepoisDe: Date): Promise<boolean> {
  const emAndamento = await db<Importacao>('importacao')
    .select('id')
    .where({ tipo, status: 'executando' })
    .where('iniciada_em', '>', iniciadaDepoisDe)
    .first();
  return emAndamento !== undefined;
}

// Versão da fonte na última execução que leu a origem com sucesso (com ou sem dado novo).
export async function buscarVersaoDaUltimaImportacao(tipo: string): Promise<string | null> {
  const ultima = await db<Importacao>('importacao')
    .select('versao_da_fonte')
    .where({ tipo })
    .whereIn('status', ['sucesso', 'sem_alteracao'])
    .orderBy('iniciada_em', 'desc')
    .first();
  return ultima?.versao_da_fonte ?? null;
}

// A execução mais recente de cada tipo; com `status`, só as que terminaram assim.
export async function listarUltimasImportacoes(status?: StatusDaImportacao[]): Promise<ImportacaoResumo[]> {
  const consulta = db<Importacao>('importacao').distinctOn('tipo').select(...COLUNAS).orderBy([
    { column: 'tipo' },
    { column: 'iniciada_em', order: 'desc' },
  ]);
  if (status) consulta.whereIn('status', status);
  return consulta;
}
