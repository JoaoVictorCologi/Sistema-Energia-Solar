import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ErroHttp } from './erros.ts';

// Mensagens do zod em português, porque elas chegam ao usuário no formulário.
z.config(z.locales.pt());

function listarCamposInvalidos(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    if (problema.code === 'unrecognized_keys') {
      for (const chave of problema.keys) campos[chave] = 'Campo não permitido.';
    } else {
      campos[problema.path.join('.') || 'corpo'] ??= problema.message;
    }
  }
  return campos;
}

// Valida o body da requisição e o troca pela versão já convertida pelo esquema.
// Campos desconhecidos são sempre recusados (.strict()), mesmo que o esquema não diga.
export function validar(esquema: z.ZodObject): RequestHandler {
  const esquemaEstrito = esquema.strict();

  return (requisicao, _resposta, next) => {
    const resultado = esquemaEstrito.safeParse(requisicao.body ?? {});
    if (!resultado.success) {
      next(new ErroHttp(400, 'ENTRADA_INVALIDA', 'Dados inválidos. Confira os campos.', listarCamposInvalidos(resultado.error)));
      return;
    }
    requisicao.body = resultado.data;
    next();
  };
}
