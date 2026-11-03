// Busca no IBGE todos os municípios do Brasil e grava na tabela municipio.
// Pode rodar de novo: só atualiza. Uso: npm run carregar-municipios
import { ErroDeConfiguracao, obterEnv } from '../src/config/env.ts';

try {
  obterEnv();
} catch (erro) {
  if (!(erro instanceof ErroDeConfiguracao)) throw erro;
  console.error(erro.message);
  process.exit(1);
}

const { db } = await import('../src/database/conexao.ts');
const { carregarMunicipios } = await import('../src/services/municipiosService.ts');

try {
  const { quantidade, ufs } = await carregarMunicipios();
  console.log(`${quantidade} municípios de ${ufs} UFs gravados.`);
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
