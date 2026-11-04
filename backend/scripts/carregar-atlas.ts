// Grava o HSP mensal de cada município do Brasil a partir do CSV de sedes municipais do Atlas 2017.
// O ZIP é baixado e descompactado manualmente, porque o download exige aceitar a licença CC BY-NC-ND do LABREN/INPE.
// Uso: npm run carregar-atlas -- <caminho>/tilted_latitude_means_sedes-munic.csv
import { ErroDeConfiguracao, obterEnv } from '../src/config/env.ts';

try {
  obterEnv();
} catch (erro) {
  if (!(erro instanceof ErroDeConfiguracao)) throw erro;
  console.error(erro.message);
  process.exit(1);
}

const { db } = await import('../src/database/conexao.ts');
const { carregarAtlas } = await import('../src/services/atlasService.ts');

function listar(titulo: string, itens: string[]): void {
  if (itens.length === 0) return;
  console.log(`\n${titulo} (${itens.length}):`);
  for (const item of itens) console.log(`  - ${item}`);
}

try {
  const caminho = process.argv[2];
  if (!caminho) throw new Error('Informe o CSV: npm run carregar-atlas -- <caminho>/tilted_latitude_means_sedes-munic.csv');
  const resultado = await carregarAtlas(caminho);
  console.log(`${resultado.irradiacoes.length} municípios com HSP gravado.`);
  listar('Linhas recusadas pela verificação de faixa', resultado.linhasRecusadas);
  listar('Linhas do Atlas sem município correspondente', resultado.linhasSemMunicipio);
  listar('Municípios sem irradiação', resultado.municipiosSemIrradiacao.map(({ nome, codigoIbge }) => `${nome} (${codigoIbge})`));
  if (resultado.municipiosSemIrradiacao.length > 0) {
    console.log('\nAcrescente em src/parametros/correcoes-atlas.json o nome usado no Atlas (em "nomes") ou a sede a usar (em "semSedeNoAtlas") e rode de novo.');
    process.exitCode = 1;
  }
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
