// Limites de requisição por IP, contra abuso e força bruta.
import { rateLimit } from 'express-rate-limit';

interface OpcoesDoLimite {
  janelaMs: number;
  maximo: number;
}

// Conta as requisições por IP dentro da janela; a de número maximo + 1 recebe 429.
export function criarLimite({ janelaMs, maximo }: OpcoesDoLimite) {
  return rateLimit({
    windowMs: janelaMs,
    limit: maximo,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'MUITAS_REQUISICOES', message: 'Muitas requisições. Aguarde um pouco e tente de novo.' } },
  });
}

// Limite padrão para rotas públicas: 30 requisições por minuto por IP. A contagem vive na instância, por isso cada router cria a sua.
export const limitePublico = criarLimite({ janelaMs: 60_000, maximo: 30 });
