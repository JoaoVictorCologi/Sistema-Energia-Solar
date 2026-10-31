// Todas as chamadas ao backend. Contrato em docs/arquitetura/backend.md.

export type Papel = 'admin' | 'usuario';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
}

interface CorpoDeErro {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
}

// Erro no formato padrão do backend: { error: { code, message, fields? } }.
export class ErroDaApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly campos: Record<string, string>;

  constructor(status: number, codigo: string, mensagem: string, campos: Record<string, string> = {}) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

// O cookie de sessão vai sozinho: em desenvolvimento o Vite repassa /api ao backend na mesma origem.
async function requisitar<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch('/api' + caminho, {
      method: opcoes.metodo ?? 'GET',
      headers: opcoes.corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    });
  } catch {
    throw new ErroDaApi(0, 'SEM_CONEXAO', 'Não foi possível falar com o servidor. Confira a conexão e tente de novo.');
  }

  if (resposta.status === 204) return undefined as T;
  const dados: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = (dados as CorpoDeErro | null)?.error;
    throw new ErroDaApi(
      resposta.status,
      erro?.code ?? 'ERRO_INTERNO',
      erro?.message ?? 'Algo deu errado. Tente de novo em instantes.',
      erro?.fields,
    );
  }
  return dados as T;
}

export async function entrar(email: string, senha: string): Promise<Usuario> {
  const { usuario } = await requisitar<{ usuario: Usuario }>('/auth/login', { metodo: 'POST', corpo: { email, senha } });
  return usuario;
}

export async function sair(): Promise<void> {
  await requisitar<void>('/auth/logout', { metodo: 'POST' });
}

// Sem sessão válida (401), devolve null em vez de erro: é o caso normal de quem ainda não entrou.
export async function buscarUsuarioLogado(): Promise<Usuario | null> {
  try {
    const { usuario } = await requisitar<{ usuario: Usuario }>('/auth/me');
    return usuario;
  } catch (erro) {
    if (erro instanceof ErroDaApi && erro.status === 401) return null;
    throw erro;
  }
}
