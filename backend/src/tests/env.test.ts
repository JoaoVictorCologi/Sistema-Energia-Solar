import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ErroDeConfiguracao, lerEnv } from '../config/env.ts';

const URL_VALIDA = 'postgres://usuario:senha@localhost:5432/solar_gestao';

describe('lerEnv', () => {
  it('aceita um .env só com DATABASE_URL e preenche os padrões', () => {
    const env = lerEnv({ DATABASE_URL: URL_VALIDA });

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3333,
      DATABASE_URL: URL_VALIDA,
      URL_FRONTEND: 'http://localhost:5173',
    });
  });

  it('recusa URL_FRONTEND que não é URL', () => {
    expect(() => lerEnv({ DATABASE_URL: URL_VALIDA, URL_FRONTEND: 'meu-site' })).toThrow(/URL_FRONTEND/);
  });

  it('recusa a falta de DATABASE_URL com mensagem que cita a variável', () => {
    expect(() => lerEnv({})).toThrow(ErroDeConfiguracao);
    expect(() => lerEnv({})).toThrow(/DATABASE_URL: obrigatória/);
  });

  it('recusa DATABASE_URL que não é do PostgreSQL', () => {
    expect(() => lerEnv({ DATABASE_URL: 'mysql://usuario:senha@localhost/banco' })).toThrow(/DATABASE_URL/);
  });

  it('recusa porta que não é número', () => {
    expect(() => lerEnv({ DATABASE_URL: URL_VALIDA, PORT: 'abc' })).toThrow(/PORT/);
  });
});

describe('inicialização do servidor', () => {
  it('não sobe sem DATABASE_URL e mostra mensagem clara', () => {
    const servidor = path.join(import.meta.dirname, '..', 'server.ts');

    const execucao = spawnSync(process.execPath, [servidor], {
      env: { PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(execucao.status).toBe(1);
    expect(execucao.stderr).toContain('Configuração inválida no backend/.env');
    expect(execucao.stderr).toContain('DATABASE_URL: obrigatória');
  });
});
