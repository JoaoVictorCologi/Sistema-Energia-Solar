// Aplica, desfaz ou cria migrations usando a mesma conexão da API.
// Uso: npm run db:migrate | npm run db:rollback | npm run db:nova-migration -- <nome>
import { ErroDeConfiguracao, lerEnv } from '../src/config/env.ts';

try {
  lerEnv(process.env);
} catch (erro) {
  if (!(erro instanceof ErroDeConfiguracao)) throw erro;
  console.error(erro.message);
  process.exit(1);
}

const { db } = await import('../src/database/conexao.ts');
const [comando, nome] = process.argv.slice(2);

async function aplicar(): Promise<void> {
  const [lote, arquivos] = await db.migrate.latest();
  console.log(arquivos.length ? `Lote ${lote}: ${arquivos.join(', ')}` : 'Nenhuma migration pendente.');
}

async function desfazer(): Promise<void> {
  const [lote, arquivos] = await db.migrate.rollback();
  console.log(arquivos.length ? `Lote ${lote} desfeito: ${arquivos.join(', ')}` : 'Nada a desfazer.');
}

async function criar(nomeDaMigration: string | undefined): Promise<void> {
  if (!nomeDaMigration) throw new Error('Informe o nome: npm run db:nova-migration -- <nome>');
  console.log(`Criada: ${await db.migrate.make(nomeDaMigration)}`);
}

const comandos: Record<string, () => Promise<void>> = {
  aplicar,
  desfazer,
  nova: () => criar(nome),
};

try {
  const executar = comandos[comando ?? ''];
  if (!executar) throw new Error(`Comando desconhecido: ${comando}. Use aplicar, desfazer ou nova.`);
  await executar();
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
