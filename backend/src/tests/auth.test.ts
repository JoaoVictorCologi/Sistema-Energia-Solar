import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request, { type Response } from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { autenticar, exigirAdmin } from '../middlewares/autenticar.ts';
import { tratarErros } from '../middlewares/erros.ts';
import { buscarUsuarioParaLogin, buscarUsuarioPorId } from '../repositories/usuariosRepository.ts';
import { gerarToken } from '../services/authService.ts';

// O banco é simulado: os testes conferem as regras de login, sessão e permissão.
vi.mock('../repositories/usuariosRepository.ts', () => ({
  buscarUsuarioParaLogin: vi.fn(),
  buscarUsuarioPorId: vi.fn(),
  existeUsuarioComEmail: vi.fn(),
  inserirUsuario: vi.fn(),
}));

const SENHA = 'senha-correta-123';
const ADMIN = { id: 1, nome: 'Ana Admin', email: 'ana@exemplo.com', papel: 'admin' as const };
const SEGREDO = process.env.JWT_SECRET ?? '';
let hashDaSenha = '';
let app: Express;

beforeAll(async () => {
  hashDaSenha = await bcrypt.hash(SENHA, 4); // custo baixo só para o teste ser rápido
});

beforeEach(() => {
  vi.mocked(buscarUsuarioParaLogin).mockImplementation(async (email) =>
    email === ADMIN.email ? { ...ADMIN, senha_hash: hashDaSenha } : undefined,
  );
  vi.mocked(buscarUsuarioPorId).mockImplementation(async (id) => (id === ADMIN.id ? ADMIN : undefined));
  app = criarApp(); // app novo a cada teste: a contagem do limite de login começa do zero
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function entrar(appDoTeste: Express, email: string, senha: string) {
  return request(appDoTeste).post('/api/auth/login').send({ email, senha });
}

function cookieDaSessao(resposta: Response): string {
  const cookies = ([] as string[]).concat(resposta.headers['set-cookie'] ?? []);
  return cookies.find((cookie) => cookie.startsWith('sessao=')) ?? '';
}

describe('POST /api/auth/login', () => {
  it('login certo responde 200 com o usuário e cria o cookie HttpOnly', async () => {
    const resposta = await entrar(app, ADMIN.email, SENHA);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ usuario: ADMIN });
    const cookie = cookieDaSessao(resposta);
    expect(cookie).toMatch(/^sessao=[^;]+/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=28800');
    expect(cookie).not.toContain('Secure');
  });

  it('aceita o e-mail com letras maiúsculas', async () => {
    const resposta = await entrar(app, 'ANA@Exemplo.com', SENHA);

    expect(resposta.status).toBe(200);
  });

  it('senha errada responde 401 com mensagem genérica e sem cookie', async () => {
    const resposta = await entrar(app, ADMIN.email, 'senha-errada-000');

    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ error: { code: 'CREDENCIAIS_INVALIDAS', message: 'E-mail ou senha incorretos.' } });
    expect(cookieDaSessao(resposta)).toBe('');
  });

  it('e-mail não cadastrado recebe a mesma resposta da senha errada', async () => {
    const senhaErrada = await entrar(app, ADMIN.email, 'senha-errada-000');
    const emailInexistente = await entrar(app, 'ninguem@exemplo.com', SENHA);

    expect(emailInexistente.status).toBe(401);
    expect(emailInexistente.body).toEqual(senhaErrada.body);
  });

  it('e-mail em formato inválido responde 400', async () => {
    const resposta = await entrar(app, 'nao-e-email', SENHA);

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('ENTRADA_INVALIDA');
  });

  it('a 6ª tentativa em 15 minutos recebe 429', async () => {
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      expect((await entrar(app, ADMIN.email, 'senha-errada-000')).status).toBe(401);
    }
    const sexta = await entrar(app, ADMIN.email, SENHA);

    expect(sexta.status).toBe(429);
    expect(sexta.body.error.code).toBe('MUITAS_REQUISICOES');
  });

  it('em produção o cookie é Secure', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const resposta = await entrar(criarApp(), ADMIN.email, SENHA);

    expect(cookieDaSessao(resposta)).toContain('Secure');
  });
});

describe('GET /api/auth/me', () => {
  it('sem cookie responde 401', async () => {
    const resposta = await request(app).get('/api/auth/me');

    expect(resposta.status).toBe(401);
    expect(resposta.body.error.code).toBe('NAO_AUTENTICADO');
  });

  it('com o cookie do login devolve o nome e nunca a senha', async () => {
    const login = await entrar(app, ADMIN.email, SENHA);

    const resposta = await request(app).get('/api/auth/me').set('Cookie', cookieDaSessao(login));

    expect(resposta.status).toBe(200);
    expect(resposta.body.usuario.nome).toBe('Ana Admin');
    expect(resposta.text).not.toContain('senha_hash');
    expect(login.text).not.toContain('senha_hash');
  });

  it.each([
    ['adulterado', () => `${gerarToken({ id: 1, papel: 'admin' })}x`],
    ['expirado', () => jwt.sign({ papel: 'admin' }, SEGREDO, { subject: '1', expiresIn: -60 })],
    ['de outro segredo', () => jwt.sign({ papel: 'admin' }, 'outro-segredo-com-mais-de-32-caracteres!!', { subject: '1' })],
  ])('token %s responde 401', async (_descricao, criarToken) => {
    const resposta = await request(app).get('/api/auth/me').set('Cookie', `sessao=${criarToken()}`);

    expect(resposta.status).toBe(401);
    expect(resposta.body.error.code).toBe('SESSAO_INVALIDA');
  });

  it('usuário que não existe mais responde 401', async () => {
    const token = gerarToken({ id: 99, papel: 'admin' });

    const resposta = await request(app).get('/api/auth/me').set('Cookie', `sessao=${token}`);

    expect(resposta.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('apaga o cookie da sessão', async () => {
    const resposta = await request(app).post('/api/auth/logout');

    expect(resposta.status).toBe(204);
    expect(cookieDaSessao(resposta)).toMatch(/^sessao=;.*Expires=Thu, 01 Jan 1970/);
  });
});

describe('autenticar + exigirAdmin', () => {
  const appRestrito = express();
  appRestrito.use(cookieParser());
  appRestrito.get('/restrita', autenticar, exigirAdmin, (_requisicao, resposta) => {
    resposta.json({ ok: true });
  });
  appRestrito.use(tratarErros);

  it('sem login responde 401', async () => {
    expect((await request(appRestrito).get('/restrita')).status).toBe(401);
  });

  it('usuário sem papel admin responde 403', async () => {
    const token = gerarToken({ id: 2, papel: 'usuario' });

    const resposta = await request(appRestrito).get('/restrita').set('Cookie', `sessao=${token}`);

    expect(resposta.status).toBe(403);
    expect(resposta.body.error.code).toBe('SEM_PERMISSAO');
  });

  it('administrador passa', async () => {
    const token = gerarToken({ id: 1, papel: 'admin' });

    const resposta = await request(appRestrito).get('/restrita').set('Cookie', `sessao=${token}`);

    expect(resposta.status).toBe(200);
  });
});
