import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { obterEnv } from '../config/env.ts';
import { ErroHttp } from '../middlewares/erros.ts';
import {
  buscarUsuarioParaLogin,
  buscarUsuarioPorId,
  existeUsuarioComEmail,
  inserirUsuario,
  type UsuarioPublico,
} from '../repositories/usuariosRepository.ts';
import type { Papel } from '../tipos/tabelas.ts';

// O que o token guarda: só o necessário para autorizar, sem dados pessoais.
export interface UsuarioDaSessao {
  id: number;
  papel: Papel;
}

export const DURACAO_DA_SESSAO_MS = 8 * 60 * 60 * 1000;
const CUSTO_DO_BCRYPT = 12;
// Hash de uma senha aleatória já descartada: ver autenticarUsuario.
const HASH_DESCARTAVEL = '$2b$12$sSkHxSnHY7R8oKFzzi5QYOU9.ryJWRuKpu3rn0/cZr8GuAQewqXNO';

const esquemaDoToken = z.object({
  sub: z.string().regex(/^\d+$/),
  papel: z.enum(['admin', 'usuario']),
});

function sessaoInvalida(): ErroHttp {
  return new ErroHttp(401, 'SESSAO_INVALIDA', 'Sessão expirada ou inválida. Faça login de novo.');
}

export async function autenticarUsuario(email: string, senha: string): Promise<UsuarioPublico> {
  const usuario = await buscarUsuarioParaLogin(email.toLowerCase());
  // Compara mesmo quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails estão cadastrados.
  const senhaConfere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_DESCARTAVEL);
  if (!usuario || !senhaConfere) {
    throw new ErroHttp(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
  }
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel };
}

export function gerarToken(usuario: UsuarioDaSessao): string {
  return jwt.sign({ papel: usuario.papel }, obterEnv().JWT_SECRET, {
    subject: String(usuario.id),
    expiresIn: DURACAO_DA_SESSAO_MS / 1000,
  });
}

export function lerToken(token: string): UsuarioDaSessao {
  try {
    const conteudo = esquemaDoToken.parse(jwt.verify(token, obterEnv().JWT_SECRET, { algorithms: ['HS256'] }));
    return { id: Number(conteudo.sub), papel: conteudo.papel };
  } catch {
    throw sessaoInvalida();
  }
}

// O token pode ser de um usuário que já não existe: /me confere no banco.
export async function buscarUsuarioLogado(id: number): Promise<UsuarioPublico> {
  const usuario = await buscarUsuarioPorId(id);
  if (!usuario) throw sessaoInvalida();
  return usuario;
}

export async function criarAdministrador(dados: { nome: string; email: string; senha: string }): Promise<UsuarioPublico> {
  const email = dados.email.toLowerCase();
  if (await existeUsuarioComEmail(email)) {
    throw new Error(`Já existe um usuário com o e-mail ${email}.`);
  }
  const senha_hash = await bcrypt.hash(dados.senha, CUSTO_DO_BCRYPT);
  return inserirUsuario({ nome: dados.nome, email, senha_hash, papel: 'admin' });
}
