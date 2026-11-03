import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { registrarPedidoDeProposta } from '../repositories/clientesRepository.ts';

vi.mock('../repositories/clientesRepository.ts', () => ({ registrarPedidoDeProposta: vi.fn() }));

const PEDIDO = {
  simulacao: 'a1f811c5-cd03-45d1-b9aa-f107b9eefb47',
  nome: '  Maria da Silva ',
  email: 'Maria.Silva@Exemplo.com',
  telefone: '(19) 99999-0000',
  aceite: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(registrarPedidoDeProposta).mockResolvedValue('criado');
});

describe('POST /api/clientes (pedido de proposta)', () => {
  it('cria o cliente ligado à simulação, com e-mail em minúsculas e telefone só com números', async () => {
    const resposta = await request(criarApp()).post('/api/clientes').send(PEDIDO);

    expect(resposta.status).toBe(201);
    expect(registrarPedidoDeProposta).toHaveBeenCalledWith({
      codigoDaSimulacao: PEDIDO.simulacao,
      nome: 'Maria da Silva',
      email: 'maria.silva@exemplo.com',
      telefone: '19999990000',
      aceiteEm: expect.any(Date),
    });
  });

  it('a resposta só confirma o recebimento, sem dados de cliente', async () => {
    const resposta = await request(criarApp()).post('/api/clientes').send(PEDIDO);

    expect(resposta.body).toEqual({ mensagem: 'Pedido recebido! Entraremos em contato para enviar a proposta.' });
  });

  it.each([
    ['sem aceite', { ...PEDIDO, aceite: undefined }, 'aceite'],
    ['aceite recusado', { ...PEDIDO, aceite: false }, 'aceite'],
    ['e-mail inválido', { ...PEDIDO, email: 'maria@' }, 'email'],
    ['telefone sem DDD', { ...PEDIDO, telefone: '99999-0000' }, 'telefone'],
    ['nome vazio', { ...PEDIDO, nome: ' ' }, 'nome'],
    ['simulação que não é um código válido', { ...PEDIDO, simulacao: '15' }, 'simulacao'],
    ['campo que o visitante não envia', { ...PEDIDO, cep: '13730250' }, 'cep'],
  ])('%s → 400', async (_caso, corpo, campo) => {
    const resposta = await request(criarApp()).post('/api/clientes').send(corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toEqual([campo]);
    expect(registrarPedidoDeProposta).not.toHaveBeenCalled();
  });

  it('a mensagem do aceite explica o motivo', async () => {
    const resposta = await request(criarApp()).post('/api/clientes').send({ ...PEDIDO, aceite: false });

    expect(resposta.body.error.fields.aceite).toBe('É preciso aceitar o uso dos dados para receber a proposta.');
  });

  it('simulação inexistente → 404', async () => {
    vi.mocked(registrarPedidoDeProposta).mockResolvedValue('simulacao_nao_encontrada');

    const resposta = await request(criarApp()).post('/api/clientes').send(PEDIDO);

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('SIMULACAO_NAO_ENCONTRADA');
  });

  it('segundo pedido para a mesma simulação → 409', async () => {
    vi.mocked(registrarPedidoDeProposta).mockResolvedValue('simulacao_ja_vinculada');

    const resposta = await request(criarApp()).post('/api/clientes').send(PEDIDO);

    expect(resposta.status).toBe(409);
    expect(resposta.body.error.code).toBe('PEDIDO_JA_ENVIADO');
  });

  it('6 pedidos do mesmo IP em 1 minuto → 429', async () => {
    const app = criarApp();
    for (let vez = 0; vez < 5; vez++) await request(app).post('/api/clientes').send(PEDIDO).expect(201);

    const resposta = await request(app).post('/api/clientes').send(PEDIDO);

    expect(resposta.status).toBe(429);
    expect(registrarPedidoDeProposta).toHaveBeenCalledTimes(5);
  });
});
