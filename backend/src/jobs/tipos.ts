// Contrato das importações agendadas, do núcleo e dos módulos (jobsDosModulos em modulos/index.ts).

export interface ContextoDaImportacao {
  // Linha desta execução na tabela importacao, para ligar os dados gravados a ela.
  importacaoId: number;
  agora: Date;
}

export interface ResultadoDaImportacao {
  status: 'sucesso' | 'sem_alteracao';
  linhasGravadas: number;
  // Data de modificação ou hash da fonte: igual à da última execução, o job não baixa nada.
  versaoDaFonte?: string;
}

export interface JobDeImportacao {
  tipo: string;
  descricao: string;
  // Expressão cron no fuso de São Paulo, ex.: '0 6 * * *' (todo dia às 06:00).
  agenda: string;
  executar: (contexto: ContextoDaImportacao) => Promise<ResultadoDaImportacao>;
}

// Dado recebido fora do esperado (unidade, faixa, coluna): a importação inteira é recusada e nada é gravado.
export class ErroDeImportacao extends Error {}
