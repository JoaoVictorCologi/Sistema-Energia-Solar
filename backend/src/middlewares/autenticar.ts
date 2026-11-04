// Autenticação pela sessão em cookie e autorização por papel.
import type { RequestHandler, Response } from 'express';
import { lerSessao, type UsuarioDaSessao } from '../services/authService.ts';
import type { Papel } from '../tipos/tabelas.ts';
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

// O papel vem do banco a cada requisição, não do token: excluir ou rebaixar um usuário vale na hora.
export const autenticar: RequestHandler = async (requisicao, resposta, next) => {
  const token: unknown = requisicao.cookies?.[NOME_DO_COOKIE];
  if (typeof token !== 'string' || token === '') {
    throw new ErroHttp(401, 'NAO_AUTENTICADO', 'Faça login para continuar.');
  }
  resposta.locals.usuario = await lerSessao(token);
  next();
};

// Para os controllers das rotas protegidas: quem fez a requisição.
export function usuarioDaSessao(resposta: Response): UsuarioDaSessao {
  const { usuario } = resposta.locals;
  if (!usuario) throw new ErroHttp(401, 'NAO_AUTENTICADO', 'Faça login para continuar.');
  return usuario;
}

// Sempre depois do autenticar.
export function exigirPapel(...papeis: Papel[]): RequestHandler {
  return (_requisicao, resposta, next) => {
    const papel = resposta.locals.usuario?.papel;
    if (!papel || !papeis.includes(papel)) {
      throw new ErroHttp(403, 'SEM_PERMISSAO', 'Seu usuário não tem acesso a esta área.');
    }
    next();
  };
}

// Só a TI: importações.
export const exigirAdmin = exigirPapel('admin');
// Quem administra a operação: usuários, configurações comerciais, formas de pagamento e catálogo.
export const exigirGestao = exigirPapel('admin', 'gestor');
// Toda a equipe: clientes, simulações e orçamentos.
export const exigirEquipe = exigirPapel('admin', 'gestor', 'operador');
