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
});

export type Env = z.infer<typeof esquemaEnv>;

export class ErroDeConfiguracao extends Error {}

export function lerEnv(variaveis: Record<string, string | undefined>): Env {
  const resultado = esquemaEnv.safeParse(variaveis);
  if (resultado.success) return resultado.data;

  const problemas = resultado.error.issues.map((problema) => `- ${problema.path.join('.')}: ${problema.message}`);
  throw new ErroDeConfiguracao(['Configuração inválida no backend/.env:', ...problemas].join('\n'));
}

// Lê o .env atual a cada chamada (é barato), para os testes poderem trocar uma variável com vi.stubEnv.
export function obterEnv(): Env {
  return lerEnv(process.env);
}
