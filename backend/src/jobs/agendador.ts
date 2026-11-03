import cron from 'node-cron';
import { registrarImportacao } from '../services/importacoesService.ts';
import { listarJobs } from './index.ts';
import type { JobDeImportacao } from './tipos.ts';

// Jobs com a mesma agenda rodam um depois do outro, na ordem da lista (ANEEL antes do Banco Central).
async function executarEmSequencia(jobs: JobDeImportacao[]): Promise<void> {
  for (const job of jobs) {
    try {
      const importacao = await registrarImportacao(job);
      if (importacao.status === 'erro') console.error(`Importação ${job.tipo} falhou: ${importacao.mensagem}`);
    } catch (erro) {
      console.error(`Importação ${job.tipo} não rodou: ${erro instanceof Error ? erro.message : erro}`);
    }
  }
}

export function iniciarAgendador(): void {
  const jobsPorAgenda = new Map<string, JobDeImportacao[]>();
  for (const job of listarJobs()) jobsPorAgenda.set(job.agenda, [...(jobsPorAgenda.get(job.agenda) ?? []), job]);
  for (const [agenda, jobs] of jobsPorAgenda) {
    cron.schedule(agenda, () => executarEmSequencia(jobs), { timezone: 'America/Sao_Paulo', noOverlap: true });
  }
}
