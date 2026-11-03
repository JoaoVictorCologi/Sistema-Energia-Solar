import type { RequestHandler } from 'express';
import { lerToken, type UsuarioDaSessao } from '../services/authService.ts';
import { ErroHttp } from './erros.ts';

export const NOME_DO_COOKIE = 'sessao';

// Depois do autenticar, res.locals.usuario traz o id e o papel de quem está logado.
declare global {
  namespace Express {
    interface Locals {
      usuario?: UsuarioDaSessao;
    }
  }
}

export const autenticar: RequestHandler = (requisicao, resposta, next) => {
  const token: unknown = requisicao.cookies?.[NOME_DO_COOKIE];
  if (typeof token !== 'string' || token === '') {
    throw new ErroHttp(401, 'NAO_AUTENTICADO', 'Faça login para continuar.');
  }
  resposta.locals.usuario = lerToken(token);
  next();
};

// Sempre depois do autenticar.
export const exigirAdmin: RequestHandler = (_requisicao, resposta, next) => {
  if (resposta.locals.usuario?.papel !== 'admin') {
    throw new ErroHttp(403, 'SEM_PERMISSAO', 'Acesso restrito ao administrador.');
  }
  next();
};
