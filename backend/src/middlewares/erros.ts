import type { ErrorRequestHandler, RequestHandler } from 'express';

// Erro previsto pela aplicação: vira resposta { error: { code, message, fields? } } com o status indicado.
export class ErroHttp extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly campos?: Record<string, string>;

  constructor(status: number, codigo: string, mensagem: string, campos?: Record<string, string>) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

// Erros do express.json() chegam com um "type" do body-parser.
function converterErroConhecido(erro: unknown): ErroHttp | undefined {
  if (erro instanceof ErroHttp) return erro;

  const tipo = typeof erro === 'object' && erro !== null && 'type' in erro ? erro.type : undefined;
  if (tipo === 'entity.parse.failed') {
    return new ErroHttp(400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.');
  }
  if (tipo === 'entity.too.large') {
    return new ErroHttp(413, 'CORPO_GRANDE_DEMAIS', 'O corpo da requisição passa do limite de 100 kB.');
  }
  return undefined;
}

export const rotaNaoEncontrada: RequestHandler = (_requisicao, _resposta, next) => {
  next(new ErroHttp(404, 'NAO_ENCONTRADO', 'Rota não encontrada.'));
};

// Express só reconhece o tratador de erros pela assinatura com 4 parâmetros.
export const tratarErros: ErrorRequestHandler = (erro, _requisicao, resposta, _next) => {
  const erroConhecido = converterErroConhecido(erro);
  if (erroConhecido) {
    const { status, codigo, message, campos } = erroConhecido;
    resposta.status(status).json({ error: { code: codigo, message, ...(campos && { fields: campos }) } });
    return;
  }

  // Erro inesperado: o detalhe fica só no log (a pilha, sem o objeto inteiro, que pode trazer dados do banco).
  console.error(erro instanceof Error ? erro.stack : 'Erro não identificado');
  resposta.status(500).json({ error: { code: 'ERRO_INTERNO', message: 'Erro interno. Tente novamente mais tarde.' } });
};
