// Roda uma importação na hora, como o botão "atualizar agora" do painel.
// Uso: npm run importar -- aneel-tarifas | bcb-indicadores (sem tipo, lista os disponíveis)
import { ErroDeConfiguracao, obterEnv } from '../src/config/env.ts';

try {
  obterEnv();
} catch (erro) {
  if (!(erro instanceof ErroDeConfiguracao)) throw erro;
  console.error(erro.message);
  process.exit(1);
}

const { db } = await import('../src/database/conexao.ts');
const { listarJobs } = await import('../src/jobs/index.ts');
const { executarImportacaoAgora } = await import('../src/services/importacoesService.ts');

try {
  const tipo = process.argv[2];
  if (!tipo) throw new Error(`Informe o tipo: ${listarJobs().map((job) => job.tipo).join(', ')}`);
  const importacao = await executarImportacaoAgora(tipo);
  console.log(`${importacao.tipo}: ${importacao.status}, ${importacao.linhas_gravadas} linhas gravadas.`);
  if (importacao.mensagem) console.log(importacao.mensagem);
  if (importacao.status === 'erro') process.exitCode = 1;
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
