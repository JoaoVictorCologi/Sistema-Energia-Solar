// Variáveis de ambiente validadas com zod: sem uma obrigatória, ou com valor inválido, nada sobe e a mensagem diz o que corrigir.
import { z } from 'zod';

const esquemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'obrigatória, no formato postgres://usuario:senha@host:5432/banco',
  }),
  // Única origem aceita pelo CORS: o site React.
  URL_FRONTEND: z.url({ error: 'precisa ser uma URL, por exemplo http://localhost:5173' }).default('http://localhost:5173'),
  // Assina o token de login; curto demais seria fácil de adivinhar.
  JWT_SECRET: z.string({ error: 'obrigatório' }).min(32, 'precisa ter pelo menos 32 caracteres'),
  // Build do site entregue pelo Express em produção, na mesma origem da API. Sem valor, usa o build do frontend no repositório.
  PASTA_DO_FRONTEND: z.string().min(1).optional(),
});

export type Env = z.infer<typeof esquemaEnv>;

// Erro próprio para a API e os scripts mostrarem só a mensagem, sem a pilha.
export class ErroDeConfiguracao extends Error {}

export function lerEnv(variaveis: Record<string, string | undefined>): Env {
  // No Render, o endereço público do serviço chega em RENDER_EXTERNAL_URL: é a origem do site.
  const resultado = esquemaEnv.safeParse({ ...variaveis, URL_FRONTEND: variaveis.URL_FRONTEND ?? variaveis.RENDER_EXTERNAL_URL });
  if (resultado.success) return resultado.data;

  const problemas = resultado.error.issues.map((problema) => `- ${problema.path.join('.')}: ${problema.message}`);
  throw new ErroDeConfiguracao(['Configuração inválida no backend/.env:', ...problemas].join('\n'));
}

// Lê o ambiente a cada chamada, o que é barato, para os testes poderem trocar uma variável com vi.stubEnv.
export function obterEnv(): Env {
  return lerEnv(process.env);
}
