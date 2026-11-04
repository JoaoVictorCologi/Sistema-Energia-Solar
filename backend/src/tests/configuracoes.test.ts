import { Decimal } from 'decimal.js';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import {
  atualizarFormaDePagamento, buscarConfiguracaoComercial, buscarFormaDePagamento, inserirFormaDePagamento, listarFormasDePagamento, registrarConfiguracaoComercial,
} from '../repositories/configuracoesRepository.ts';
import { gerarToken } from '../services/authService.ts';
import { AVISTA, CONFIGURACAO_INICIAL, FINANCIAMENTO } from './apoio/comercialDeTeste.ts';

vi.mock('../repositories/usuariosRepository.ts', () => import('./apoio/usuariosDeTeste.ts'));
vi.mock('../repositories/configuracoesRepository.ts', () => ({
  buscarConfiguracaoComercial: vi.fn(), registrarConfiguracaoComercial: vi.fn(), listarFormasDePagamento: vi.fn(), buscarFormaDePagamento: vi.fn(),
  inserirFormaDePagamento: vi.fn(), atualizarFormaDePagamento: vi.fn(),
}));

const OPERADOR = `sessao=${gerarToken({ id: 2, papel: 'operador' })}`;
const GESTOR = `sessao=${gerarToken({ id: 3, papel: 'gestor' })}`;
const ADMIN = `sessao=${gerarToken({ id: 1, papel: 'admin' })}`;
const CONFIG = '/api/admin/configuracoes-comerciais';
const FORMAS = '/api/admin/formas-pagamento';
const NOVA_FORMA = { tipo: 'parcelado', nome: 'Boleto', taxaMensal: 0.02, parcelasMinimas: 1, parcelasMaximas: 24, ativa: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarConfiguracaoComercial).mockResolvedValue(CONFIGURACAO_INICIAL);
  vi.mocked(listarFormasDePagamento).mockImplementation(async (somenteAtivas) => (somenteAtivas ? [AVISTA] : [AVISTA, { ...FINANCIAMENTO, ativa: false, taxaMensal: null }]));
  vi.mocked(buscarFormaDePagamento).mockImplementation(async (id) => (id === FINANCIAMENTO.id ? { ...FINANCIAMENTO, ativa: false, taxaMensal: null } : undefined));
  vi.mocked(inserirFormaDePagamento).mockImplementation(async (dados) => ({ id: 9, ...dados }));
  vi.mocked(atualizarFormaDePagamento).mockImplementation(async (id, dados) => ({ id, ...dados }));
});

describe('acesso', () => {
  it.each([
    ['get', CONFIG], ['patch', CONFIG], ['get', FORMAS], ['post', FORMAS], ['patch', `${FORMAS}/3`],
  ] as const)('%s %s sem login → 401', async (metodo, rota) => {
    expect((await request(criarApp())[metodo](rota)).status).toBe(401);
  });

  it.each([['patch', CONFIG, { margem: 0.3 }], ['post', FORMAS, NOVA_FORMA], ['patch', `${FORMAS}/3`, { ativa: true }]] as const)('%s %s: operador → 403', async (metodo, rota, corpo) => {
    const resposta = await request(criarApp())[metodo](rota).set('Cookie', OPERADOR).send(corpo);

    expect(resposta.status).toBe(403);
    expect(resposta.body.error.code).toBe('SEM_PERMISSAO');
    expect(registrarConfiguracaoComercial).not.toHaveBeenCalled();
    expect(inserirFormaDePagamento).not.toHaveBeenCalled();
    expect(atualizarFormaDePagamento).not.toHaveBeenCalled();
  });

  it('operador lê as configurações e as formas, para orçar', async () => {
    expect((await request(criarApp()).get(CONFIG).set('Cookie', OPERADOR)).status).toBe(200);
    expect((await request(criarApp()).get(FORMAS).set('Cookie', OPERADOR)).status).toBe(200);
  });
});

describe('configurações comerciais', () => {
  it('devolve os valores vigentes', async () => {
    const resposta = await request(criarApp()).get(CONFIG).set('Cookie', GESTOR);

    expect(resposta.body.configuracao).toEqual({
      margem: 0.2, instalacaoPorKwp: 700, custoReferenciaPorKwp: 4000, validadeDias: 10, limiteDesconto: 0.1, alteradoEm: CONFIGURACAO_INICIAL.alteradoEm.toISOString(),
    });
  });

  it('gestor altera: grava uma nova linha com os demais valores vigentes e quem alterou', async () => {
    const resposta = await request(criarApp()).patch(CONFIG).set('Cookie', GESTOR).send({ margem: 0.25 });

    expect(resposta.status).toBe(200);
    const [dados, usuarioId] = vi.mocked(registrarConfiguracaoComercial).mock.calls[0];
    expect(dados.margem.toString()).toBe('0.25');
    expect(dados.instalacaoPorKwp.toString()).toBe('700');
    expect(usuarioId).toBe(3);
  });

  it.each([
    ['margem acima de 100%', { margem: 1.5 }, 'margem'],
    ['margem negativa', { margem: -0.1 }, 'margem'],
    ['validade zerada', { validadeDias: 0 }, 'validadeDias'],
    ['limite de desconto acima de 100%', { limiteDesconto: 2 }, 'limiteDesconto'],
    ['campo desconhecido', { imposto: 0.1 }, 'imposto'],
    ['nada para mudar', {}, 'corpo'],
  ])('%s → 400, sem gravar', async (_caso, corpo, campo) => {
    const resposta = await request(criarApp()).patch(CONFIG).set('Cookie', GESTOR).send(corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
    expect(registrarConfiguracaoComercial).not.toHaveBeenCalled();
  });
});

describe('formas de pagamento', () => {
  it('lista todas no painel, com os números', async () => {
    const resposta = await request(criarApp()).get(FORMAS).set('Cookie', OPERADOR);

    expect(listarFormasDePagamento).toHaveBeenCalledWith(false);
    expect(resposta.body.formas[0]).toEqual({
      id: 1, tipo: 'avista', nome: 'À vista', taxaMensal: null, parcelasMinimas: 1, parcelasMaximas: 1, entradaMinima: 0, carenciaMaximaDias: 0, descontoAvista: 0.05, ativa: true,
    });
  });

  it('a rota pública mostra só nome e tipo das formas ativas, sem login', async () => {
    const resposta = await request(criarApp()).get('/api/formas-pagamento');

    expect(resposta.status).toBe(200);
    expect(listarFormasDePagamento).toHaveBeenCalledWith(true);
    expect(resposta.body).toEqual({ formas: [{ nome: 'À vista', tipo: 'avista' }] });
  });

  it('gestor cadastra, com a taxa como Decimal, e o admin também pode', async () => {
    const resposta = await request(criarApp()).post(FORMAS).set('Cookie', GESTOR).send(NOVA_FORMA);

    expect(resposta.status).toBe(201);
    const [dados, usuarioId] = vi.mocked(inserirFormaDePagamento).mock.calls[0];
    expect(dados.taxaMensal).toEqual(new Decimal('0.02'));
    expect(usuarioId).toBe(3);
    expect(resposta.body.forma).toMatchObject({ id: 9, nome: 'Boleto', taxaMensal: 0.02, parcelasMaximas: 24, entradaMinima: 0 });

    expect((await request(criarApp()).post(FORMAS).set('Cookie', ADMIN).send(NOVA_FORMA)).status).toBe(201);
  });

  it('nome repetido → 409', async () => {
    vi.mocked(inserirFormaDePagamento).mockResolvedValue(null);

    const resposta = await request(criarApp()).post(FORMAS).set('Cookie', GESTOR).send(NOVA_FORMA);

    expect(resposta.status).toBe(409);
    expect(resposta.body.error.code).toBe('FORMA_DUPLICADA');
  });

  it.each([
    ['ativa sem taxa', { ...NOVA_FORMA, taxaMensal: null }, 'taxaMensal'],
    ['à vista parcelado', { ...NOVA_FORMA, tipo: 'avista', parcelasMaximas: 3 }, 'parcelasMaximas'],
    ['mínimo acima do máximo', { ...NOVA_FORMA, parcelasMinimas: 30 }, 'parcelasMinimas'],
    ['taxa negativa', { ...NOVA_FORMA, taxaMensal: -0.01 }, 'taxaMensal'],
    ['tipo desconhecido', { ...NOVA_FORMA, tipo: 'fiado' }, 'tipo'],
    ['sem nome', { ...NOVA_FORMA, nome: '' }, 'nome'],
  ])('%s → 400, sem gravar', async (_caso, corpo, campo) => {
    const resposta = await request(criarApp()).post(FORMAS).set('Cookie', GESTOR).send(corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
    expect(inserirFormaDePagamento).not.toHaveBeenCalled();
  });

  it('forma sem taxa não ativa; com a taxa preenchida, ativa', async () => {
    const semTaxa = await request(criarApp()).patch(`${FORMAS}/3`).set('Cookie', GESTOR).send({ ativa: true });
    expect(semTaxa.status).toBe(400);
    expect(semTaxa.body.error.fields).toHaveProperty('taxaMensal');

    const comTaxa = await request(criarApp()).patch(`${FORMAS}/3`).set('Cookie', GESTOR).send({ ativa: true, taxaMensal: 0.015 });
    expect(comTaxa.status).toBe(200);
    expect(comTaxa.body.forma).toMatchObject({ ativa: true, taxaMensal: 0.015, nome: 'Financiamento solar' });
  });

  it('forma inexistente → 404; sem nada para mudar → 400', async () => {
    const inexistente = await request(criarApp()).patch(`${FORMAS}/99`).set('Cookie', GESTOR).send({ ativa: false });

    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe('FORMA_NAO_ENCONTRADA');
    expect((await request(criarApp()).patch(`${FORMAS}/3`).set('Cookie', GESTOR).send({})).status).toBe(400);
  });
});
