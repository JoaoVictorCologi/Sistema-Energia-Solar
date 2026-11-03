// Cria um administrador pedindo os dados no terminal.
// A senha não aparece na tela nem fica no histórico do shell. Uso: npm run criar-admin
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { z } from 'zod';
import { ErroDeConfiguracao, obterEnv } from '../src/config/env.ts';

const esquemaAdministrador = z.object({
  nome: z.string().trim().min(2, 'informe o nome').max(120, 'nome longo demais'),
  email: z.email('e-mail inválido').max(254, 'e-mail longo demais'),
  // O bcrypt só considera os primeiros 72 bytes da senha.
  senha: z.string().min(10, 'a senha precisa ter pelo menos 10 caracteres').max(72, 'a senha pode ter no máximo 72 caracteres'),
});

try {
  obterEnv();
} catch (erro) {
  if (!(erro instanceof ErroDeConfiguracao)) throw erro;
  console.error(erro.message);
  process.exit(1);
}

const { db } = await import('../src/database/conexao.ts');
const { criarAdministrador } = await import('../src/services/authService.ts');

// O eco do que é digitado passa por esta saída; na senha ela fica muda.
let saidaMuda = false;
const saida = new Writable({
  write(trecho, _codificacao, terminar) {
    if (!saidaMuda) process.stdout.write(trecho);
    terminar();
  },
});
const terminal = createInterface({ input: process.stdin, output: saida, terminal: process.stdin.isTTY });
const linhas = terminal[Symbol.asyncIterator]();

async function perguntar(pergunta: string, oculta = false): Promise<string> {
  process.stdout.write(pergunta);
  saidaMuda = oculta;
  const { value } = await linhas.next();
  saidaMuda = false;
  if (oculta) process.stdout.write('\n');
  return value ?? '';
}

async function lerDadosDoAdministrador() {
  const nome = await perguntar('Nome: ');
  const email = await perguntar('E-mail: ');
  const senha = await perguntar('Senha (mínimo 10 caracteres): ', true);
  const confirmacao = await perguntar('Repita a senha: ', true);
  if (senha !== confirmacao) throw new Error('As senhas não conferem.');

  const resultado = esquemaAdministrador.safeParse({ nome, email: email.trim(), senha });
  if (!resultado.success) throw new Error(resultado.error.issues.map((problema) => problema.message).join('; '));
  return resultado.data;
}

try {
  const administrador = await criarAdministrador(await lerDadosDoAdministrador());
  console.log(`Administrador criado: ${administrador.nome} <${administrador.email}>`);
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  terminal.close();
  await db.destroy();
}
