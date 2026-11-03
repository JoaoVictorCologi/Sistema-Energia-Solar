import { listarJobs } from '../jobs/index.ts';
import type { JobDeImportacao } from '../jobs/tipos.ts';
import { ErroDeImportacao } from '../jobs/tipos.ts';
import { ErroDeIntegracao } from '../integracoes/http.ts';
import { ErroHttp } from '../middlewares/erros.ts';
import {
  existeImportacaoEmAndamento, finalizarImportacao, iniciarImportacao, listarUltimasImportacoes, type ImportacaoResumo,
} from '../repositories/importacoesRepository.ts';

// Execução que passou disso sem terminar (servidor reiniciado no meio) deixa de bloquear a próxima.
const TEMPO_MAXIMO_DE_EXECUCAO_MS = 30 * 60_000;

export interface SituacaoDaImportacao {
  tipo: string;
  descricao: string;
  agenda: string;
  ultimaExecucao: ImportacaoResumo | null;
  ultimoSucessoEm: Date | null;
}

// Erros previstos (fonte fora do ar, dado recusado) vão para a tela; o resto fica só no log do servidor.
function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroDeIntegracao || erro instanceof ErroDeImportacao) return erro.message;
  console.error(erro);
  return 'Erro inesperado na importação; detalhes no log do servidor.';
}

// Função pública para registrar uma importação: marca o início, executa e grava o resultado na tabela importacao.
// Uma falha nunca apaga dados: o sistema segue com a última importação bem-sucedida.
export async function registrarImportacao(job: JobDeImportacao, agora = new Date()): Promise<ImportacaoResumo> {
  if (await existeImportacaoEmAndamento(job.tipo, new Date(agora.getTime() - TEMPO_MAXIMO_DE_EXECUCAO_MS))) {
    throw new ErroHttp(409, 'IMPORTACAO_EM_ANDAMENTO', 'Esta importação já está rodando. Aguarde terminar.');
  }
  const importacaoId = await iniciarImportacao(job.tipo, agora);
  try {
    const resultado = await job.executar({ importacaoId, agora });
    return await finalizarImportacao(importacaoId, {
      status: resultado.status,
      linhasGravadas: resultado.linhasGravadas,
      versaoDaFonte: resultado.versaoDaFonte ?? null,
      mensagem: null,
    }, new Date());
  } catch (erro) {
    return finalizarImportacao(importacaoId, { status: 'erro', linhasGravadas: 0, versaoDaFonte: null, mensagem: mensagemDoErro(erro) }, new Date());
  }
}

export async function listarSituacaoDasImportacoes(): Promise<SituacaoDaImportacao[]> {
  const [ultimas, ultimosSucessos] = await Promise.all([listarUltimasImportacoes(), listarUltimasImportacoes(['sucesso', 'sem_alteracao'])]);
  return listarJobs().map(({ tipo, descricao, agenda }) => ({
    tipo,
    descricao,
    agenda,
    ultimaExecucao: ultimas.find((importacao) => importacao.tipo === tipo) ?? null,
    ultimoSucessoEm: ultimosSucessos.find((importacao) => importacao.tipo === tipo)?.finalizada_em ?? null,
  }));
}

export async function executarImportacaoAgora(tipo: string): Promise<ImportacaoResumo> {
  const job = listarJobs().find((item) => item.tipo === tipo);
  if (!job) throw new ErroHttp(404, 'IMPORTACAO_DESCONHECIDA', 'Importação desconhecida.');
  return registrarImportacao(job);
}
