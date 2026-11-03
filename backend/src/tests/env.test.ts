import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ErroDeConfiguracao, lerEnv } from '../config/env.ts';

const ENV_MINIMO = {
  DATABASE_URL: 'postgres://usuario:senha@localhost:5432/solar_gestao',
  JWT_SECRET: 'um-segredo-qualquer-com-mais-de-32-caracteres',
};

describe('lerEnv', () => {
  it('aceita um .env só com as obrigatórias e preenche os padrões', () => {
    const env = lerEnv(ENV_MINIMO);

    expect(env).toEqual({
      ...ENV_MINIMO,
      NODE_ENV: 'development',
      PORT: 3333,
      URL_FRONTEND: 'http://localhost:5173',
    });
  });

  it('recusa a falta de DATABASE_URL com mensagem que cita a variável', () => {
    const semBanco = { JWT_SECRET: ENV_MINIMO.JWT_SECRET };

    expect(() => lerEnv(semBanco)).toThrow(ErroDeConfiguracao);
    expect(() => lerEnv(semBanco)).toThrow(/DATABASE_URL: obrigatória/);
  });

  it('recusa DATABASE_URL que não é do PostgreSQL', () => {
    expect(() => lerEnv({ ...ENV_MINIMO, DATABASE_URL: 'mysql://usuario:senha@localhost/banco' })).toThrow(/DATABASE_URL/);
  });

  it('recusa porta que não é número', () => {
    expect(() => lerEnv({ ...ENV_MINIMO, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('recusa URL_FRONTEND que não é URL', () => {
    expect(() => lerEnv({ ...ENV_MINIMO, URL_FRONTEND: 'meu-site' })).toThrow(/URL_FRONTEND/);
  });

  it('exige JWT_SECRET com pelo menos 32 caracteres', () => {
    expect(() => lerEnv({ DATABASE_URL: ENV_MINIMO.DATABASE_URL })).toThrow(/JWT_SECRET: obrigatório/);
    expect(() => lerEnv({ ...ENV_MINIMO, JWT_SECRET: 'curto' })).toThrow(/JWT_SECRET: precisa ter pelo menos 32/);
  });
});

describe('inicialização do servidor', () => {
  it('não sobe sem DATABASE_URL e mostra mensagem clara', () => {
    const servidor = path.join(import.meta.dirname, '..', 'server.ts');

    const execucao = spawnSync(process.execPath, [servidor], {
      env: { PATH: process.env.PATH, JWT_SECRET: ENV_MINIMO.JWT_SECRET },
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(execucao.status).toBe(1);
    expect(execucao.stderr).toContain('Configuração inválida no backend/.env');
    expect(execucao.stderr).toContain('DATABASE_URL: obrigatória');
  });
});
