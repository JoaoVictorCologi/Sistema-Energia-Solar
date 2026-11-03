// Cria dados fictícios para a apresentação (catálogo, clientes, simulações e propostas).
// Pode rodar de novo: apaga só os dados de demonstração anteriores. Uso: npm run dados-demo [-- --confirmar]
import { ErroDeConfiguracao, obterEnv } from '../src/config/env.ts';
import { conferirAmbiente } from '../src/services/demonstracaoAmbiente.ts';

const recusa = conferirAmbiente(process.env.NODE_ENV, process.argv.slice(2));
if (recusa) {
  console.error(recusa);
  process.exit(1);
}

try {
  obterEnv();
} catch (erro) {
  if (!(erro instanceof ErroDeConfiguracao)) throw erro;
  console.error(erro.message);
  process.exit(1);
}

const { db } = await import('../src/database/conexao.ts');
const { criarDadosDeDemonstracao } = await import('../src/services/demonstracaoService.ts');

try {
  const { clientes, propostas } = await criarDadosDeDemonstracao();
  console.log(`Demonstração pronta: 5 equipamentos, ${clientes} clientes com simulação e ${propostas} propostas.`);
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
