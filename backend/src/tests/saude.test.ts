import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { verificarConexaoBanco } from '../repositories/saudeRepository.ts';

// O banco é simulado: o teste confere a rota, não o PostgreSQL.
vi.mock('../repositories/saudeRepository.ts', () => ({
  verificarConexaoBanco: vi.fn(),
}));

const verificarConexaoBancoSimulada = vi.mocked(verificarConexaoBanco);

describe('GET /api/health', () => {
  beforeEach(() => {
    verificarConexaoBancoSimulada.mockReset();
  });

  it('responde ok quando o banco responde', async () => {
    verificarConexaoBancoSimulada.mockResolvedValue();

    const resposta = await request(criarApp()).get('/api/health');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ status: 'ok', banco: 'ok' });
  });

  it('responde 503 sem detalhes internos quando o banco falha', async () => {
    verificarConexaoBancoSimulada.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    const resposta = await request(criarApp()).get('/api/health');

    expect(resposta.status).toBe(503);
    expect(resposta.body).toEqual({ status: 'erro', banco: 'erro' });
    expect(JSON.stringify(resposta.body)).not.toContain('ECONNREFUSED');
  });
});
