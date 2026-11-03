import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { criarApp } from '../app.ts';
import { tratarErros } from '../middlewares/erros.ts';
import { limitePublico } from '../middlewares/limites.ts';
import { validar } from '../middlewares/validar.ts';

vi.mock('../repositories/saudeRepository.ts', () => ({
  verificarConexaoBanco: vi.fn().mockResolvedValue(undefined),
}));

const URL_FRONTEND = 'http://localhost:5173';
const app = criarApp();

// App mínimo para testar um middleware isolado, com o mesmo tratador de erros da API.
function criarAppDeTeste(...middlewares: RequestHandler[]): Express {
  const appDeTeste = express();
  appDeTeste.use(express.json());
  appDeTeste.post('/teste', ...middlewares, (requisicao, resposta) => {
    resposta.json(requisicao.body);
  });
  appDeTeste.use(tratarErros);
  return appDeTeste;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cabeçalhos HTTP (helmet)', () => {
  it('envia os cabeçalhos de proteção e esconde o Express', async () => {
    const resposta = await request(app).get('/api/health');

    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
    expect(resposta.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(resposta.headers['content-security-policy']).toBeDefined();
    expect(resposta.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('libera o site React, com cookies', async () => {
    const resposta = await request(app).get('/api/health').set('Origin', URL_FRONTEND);

    expect(resposta.headers['access-control-allow-origin']).toBe(URL_FRONTEND);
    expect(resposta.headers['access-control-allow-credentials']).toBe('true');
  });

  it('não libera outra origem', async () => {
    const resposta = await request(app).get('/api/health').set('Origin', 'https://site-estranho.com');

    expect(resposta.headers['access-control-allow-origin']).not.toBe('https://site-estranho.com');
  });
});

describe('corpo da requisição', () => {
  it('recusa JSON malformado com 400', async () => {
    const resposta = await request(app).post('/api/qualquer').set('Content-Type', 'application/json').send('{"nome":');

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('JSON_INVALIDO');
  });

  it('recusa corpo acima de 100 kB com 413', async () => {
    const resposta = await request(app).post('/api/qualquer').send({ texto: 'a'.repeat(101 * 1024) });

    expect(resposta.status).toBe(413);
    expect(resposta.body.error.code).toBe('CORPO_GRANDE_DEMAIS');
  });
});

describe('validar(schema)', () => {
  const appDeTeste = criarAppDeTeste(validar(z.object({ nome: z.string().min(1), idade: z.number().int() })));

  it('recusa body inválido com 400 e diz qual campo corrigir', async () => {
    const resposta = await request(appDeTeste).post('/teste').send({ nome: '', idade: 'dez' });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('ENTRADA_INVALIDA');
    expect(Object.keys(resposta.body.error.fields)).toEqual(['nome', 'idade']);
  });

  it('recusa campo desconhecido', async () => {
    const resposta = await request(appDeTeste).post('/teste').send({ nome: 'Ana', idade: 30, preco: 1 });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.fields).toEqual({ preco: 'Campo não permitido.' });
  });

  it('deixa passar body válido', async () => {
    const resposta = await request(appDeTeste).post('/teste').send({ nome: 'Ana', idade: 30 });

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ nome: 'Ana', idade: 30 });
  });
});

describe('erros', () => {
  it('erro interno responde 500 sem pilha nem mensagem original', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const falhar: RequestHandler = () => {
      throw new Error('senha do banco: segredo123');
    };

    const resposta = await request(criarAppDeTeste(falhar)).post('/teste').send({});

    expect(resposta.status).toBe(500);
    expect(resposta.body).toEqual({ error: { code: 'ERRO_INTERNO', message: 'Erro interno. Tente novamente mais tarde.' } });
    expect(resposta.text).not.toContain('segredo123');
    expect(resposta.text).not.toContain('at ');
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('rota inexistente da API responde 404 no formato padrão', async () => {
    const resposta = await request(app).get('/api/nao-existe');

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('NAO_ENCONTRADO');
  });
});

describe('limite de requisições', () => {
  it('a 31ª requisição pública no minuto recebe 429', async () => {
    const appDeTeste = criarAppDeTeste(limitePublico);

    for (let numero = 1; numero <= 30; numero++) {
      const resposta = await request(appDeTeste).post('/teste').send({});
      expect(resposta.status).toBe(200);
    }
    const resposta = await request(appDeTeste).post('/teste').send({});

    expect(resposta.status).toBe(429);
    expect(resposta.body.error.code).toBe('MUITAS_REQUISICOES');
  });
});
