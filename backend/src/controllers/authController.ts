import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import { obterEnv } from '../config/env.ts';
import { NOME_DO_COOKIE } from '../middlewares/autenticar.ts';
import { ErroHttp } from '../middlewares/erros.ts';
import {
  autenticarUsuario,
  buscarUsuarioLogado,
  DURACAO_DA_SESSAO_MS,
  gerarToken,
} from '../services/authService.ts';

export const esquemaLogin = z.object({
  email: z.email().max(254),
  senha: z.string().min(1).max(200),
});

// HttpOnly: o JavaScript da página não lê o token. Lax: outro site não envia o cookie num POST.
function opcoesDoCookie(): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: obterEnv().NODE_ENV === 'production', path: '/' };
}

export async function entrar(requisicao: Request, resposta: Response): Promise<void> {
  const { email, senha } = requisicao.body as z.infer<typeof esquemaLogin>;
  const usuario = await autenticarUsuario(email, senha);

  resposta.cookie(NOME_DO_COOKIE, gerarToken(usuario), { ...opcoesDoCookie(), maxAge: DURACAO_DA_SESSAO_MS });
  resposta.json({ usuario });
}

export function sair(_requisicao: Request, resposta: Response): void {
  resposta.clearCookie(NOME_DO_COOKIE, opcoesDoCookie());
  resposta.status(204).end();
}

export async function obterUsuarioLogado(_requisicao: Request, resposta: Response): Promise<void> {
  const sessao = resposta.locals.usuario;
  if (!sessao) throw new ErroHttp(401, 'NAO_AUTENTICADO', 'Faça login para continuar.');

  resposta.json({ usuario: await buscarUsuarioLogado(sessao.id) });
}
