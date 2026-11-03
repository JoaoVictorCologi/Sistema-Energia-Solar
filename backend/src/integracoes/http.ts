// Chamada HTTP comum a todas as integrações (IBGE, ViaCEP, ANEEL, Banco Central):
// timeout em cada tentativa e no máximo 3 tentativas (AGENTS.md, regra obrigatória 10).

export class ErroDeIntegracao extends Error {}

export interface OpcoesDaRequisicao {
  metodo?: 'GET' | 'POST';
  corpo?: unknown;
  timeoutMs?: number;
  tentativas?: number;
  esperaEntreTentativasMs?: number;
}

const TENTATIVAS_MAXIMAS = 3;

function valeAPenaRepetir(status: number): boolean {
  return status === 429 || status >= 500;
}

function descreverFalha(erro: unknown): string {
  if (erro instanceof SyntaxError) return 'resposta não é JSON';
  if (erro instanceof Error && erro.name === 'TimeoutError') return 'tempo esgotado';
  return 'falha de conexão';
}

async function tentarUmaVez(url: string, opcoes: OpcoesDaRequisicao): Promise<Response> {
  return fetch(url, {
    method: opcoes.metodo ?? 'GET',
    headers: opcoes.corpo === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    signal: AbortSignal.timeout(opcoes.timeoutMs ?? 10_000),
  });
}

export async function buscarJson(url: string, opcoes: OpcoesDaRequisicao = {}): Promise<unknown> {
  const tentativas = Math.min(opcoes.tentativas ?? TENTATIVAS_MAXIMAS, TENTATIVAS_MAXIMAS);
  const espera = opcoes.esperaEntreTentativasMs ?? 1_000;
  const { hostname } = new URL(url);
  let motivo = '';

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    if (tentativa > 1) await new Promise((resolver) => setTimeout(resolver, espera * (tentativa - 1)));
    try {
      const resposta = await tentarUmaVez(url, opcoes);
      if (resposta.ok) return await resposta.json();
      motivo = `HTTP ${resposta.status}`;
      if (!valeAPenaRepetir(resposta.status)) break;
    } catch (erro) {
      motivo = descreverFalha(erro);
      if (erro instanceof SyntaxError) break;
    }
  }
  throw new ErroDeIntegracao(`${hostname} não respondeu como esperado (${motivo}).`);
}
