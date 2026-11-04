// Situação das importações de dados e execução sob demanda.
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ErroHttp } from '../middlewares/erros.ts';
import type { ImportacaoResumo } from '../repositories/importacoesRepository.ts';
import { executarImportacaoAgora, listarSituacaoDasImportacoes } from '../services/importacoesService.ts';

const esquemaTipo = z.object({ tipo: z.string().regex(/^[a-z0-9-]{1,60}$/) });

function comoExecucao(importacao: ImportacaoResumo) {
  return {
    id: importacao.id,
    status: importacao.status,
    iniciadaEm: importacao.iniciada_em,
    finalizadaEm: importacao.finalizada_em,
    linhasGravadas: importacao.linhas_gravadas,
    mensagem: importacao.mensagem,
  };
}

export async function listarImportacoes(_requisicao: Request, resposta: Response): Promise<void> {
  const situacoes = await listarSituacaoDasImportacoes();
  resposta.json({
    importacoes: situacoes.map((situacao) => ({
      ...situacao,
      ultimaExecucao: situacao.ultimaExecucao && comoExecucao(situacao.ultimaExecucao),
    })),
  });
}

// Roda na hora e responde quando terminar; falha da fonte volta com status "erro" e a mensagem.
export async function executarImportacao(requisicao: Request, resposta: Response): Promise<void> {
  const parametros = esquemaTipo.safeParse(requisicao.params);
  if (!parametros.success) throw new ErroHttp(404, 'IMPORTACAO_DESCONHECIDA', 'Importação desconhecida.');
  const importacao = await executarImportacaoAgora(parametros.data.tipo);
  resposta.json({ importacao: { tipo: importacao.tipo, ...comoExecucao(importacao) } });
}
