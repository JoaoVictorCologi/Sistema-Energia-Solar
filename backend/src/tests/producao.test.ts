import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { lerEnv } from '../config/env.ts';

// Um build do React de mentira: index.html e um arquivo com hash em assets/.
let pasta: string;
beforeAll(() => {
  pasta = mkdtempSync(path.join(tmpdir(), 'frontend-'));
  mkdirSync(path.join(pasta, 'assets'));
  writeFileSync(path.join(pasta, 'index.html'), '<!doctype html><div id="raiz"></div>');
  writeFileSync(path.join(pasta, 'assets', 'index-abc123.js'), 'console.info(1)');
});

afterEach(() => vi.unstubAllEnvs());

function appDeProducao() {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PASTA_DO_FRONTEND', pasta);
  return criarApp();
}

describe('site e API na mesma origem (produção)', () => {
  it('entrega o index.html na raiz e nas rotas da tela, sem cache', async () => {
    for (const rota of ['/', '/simulador', '/admin/clientes/7']) {
      const resposta = await request(appDeProducao()).get(rota);
      expect(resposta.status).toBe(200);
      expect(resposta.text).toContain('id="raiz"');
      expect(resposta.headers['cache-control']).toBe('no-cache');
    }
  });

  it('arquivos de /assets ficam em cache por um ano', async () => {
    const resposta = await request(appDeProducao()).get('/assets/index-abc123.js');

    expect(resposta.status).toBe(200);
    expect(resposta.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('rota inexistente da API continua em JSON, sem cair no index.html', async () => {
    const resposta = await request(appDeProducao()).get('/api/nada');

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('NAO_ENCONTRADO');
  });

  it('a CSP libera só o iframe do mapa, além da própria origem', async () => {
    const resposta = await request(appDeProducao()).get('/');

    expect(resposta.headers['content-security-policy']).toContain("frame-src 'self' https://maps.google.com https://www.google.com");
    expect(resposta.headers['content-security-policy']).toContain("script-src 'self'");
  });

  it('fora de produção não entrega o site (em desenvolvimento quem entrega é o Vite)', async () => {
    vi.stubEnv('PASTA_DO_FRONTEND', pasta);

    expect((await request(criarApp()).get('/simulador')).status).toBe(404);
  });

  it('sem o build, a API sobe mesmo assim', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PASTA_DO_FRONTEND', path.join(pasta, 'nao-existe'));

    expect((await request(criarApp()).get('/api/nada')).status).toBe(404);
  });
});

describe('configuração no Render', () => {
  const MINIMO = { DATABASE_URL: 'postgres://u:s@localhost:5432/b', JWT_SECRET: 'x'.repeat(32) };

  it('sem URL_FRONTEND, usa o endereço público do serviço (RENDER_EXTERNAL_URL)', () => {
    expect(lerEnv({ ...MINIMO, RENDER_EXTERNAL_URL: 'https://solar-gestao.onrender.com' }).URL_FRONTEND).toBe('https://solar-gestao.onrender.com');
  });

  it('URL_FRONTEND definida tem prioridade', () => {
    expect(lerEnv({ ...MINIMO, URL_FRONTEND: 'https://exemplo.com', RENDER_EXTERNAL_URL: 'https://x.onrender.com' }).URL_FRONTEND).toBe('https://exemplo.com');
  });
});
