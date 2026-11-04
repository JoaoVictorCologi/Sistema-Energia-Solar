// Rotas de usinas pelo Express real, com os repositories simulados: cobre validação, regras e respostas, não as consultas no banco.
import { Decimal } from 'decimal.js';
import type { Knex } from 'knex';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../../../app.ts';
import { buscarClientePorId } from '../../../repositories/clientesRepository.ts';
import { buscarMunicipio } from '../../../repositories/municipiosRepository.ts';
import { gerarToken } from '../../../services/authService.ts';
import {
  atualizarEquipamentoDaUsina, atualizarUsina, buscarEquipamentoDaUsina, buscarMunicipiosPorNome, buscarUsinaPorId, comUsinaTravada, existeSerieNaUsina,
  inserirEquipamentoDaUsina, inserirUsina, listarEquipamentosDaUsina, listarUsinas, marcarUsinaComoDesativada, type EquipamentoDaUsina, type UsinaDoBanco,
} from '../repositories/usinasRepository.ts';

vi.mock('../../../repositories/clientesRepository.ts', () => ({ buscarClientePorId: vi.fn() }));
vi.mock('../../../repositories/municipiosRepository.ts', () => ({ buscarMunicipio: vi.fn() }));
vi.mock('../repositories/usinasRepository.ts', () => ({
  atualizarEquipamentoDaUsina: vi.fn(),
  atualizarUsina: vi.fn(),
  buscarEquipamentoDaUsina: vi.fn(),
  buscarMunicipiosPorNome: vi.fn(),
  buscarUsinaPorId: vi.fn(),
  comUsinaTravada: vi.fn(),
  existeSerieNaUsina: vi.fn(),
  inserirEquipamentoDaUsina: vi.fn(),
  inserirUsina: vi.fn(),
  listarEquipamentosDaUsina: vi.fn(),
  listarUsinas: vi.fn(),
  marcarUsinaComoDesativada: vi.fn(),
}));

const ADMIN = `sessao=${gerarToken({ id: 1, papel: 'admin' })}`;
const USUARIO = `sessao=${gerarToken({ id: 2, papel: 'usuario' })}`;
const TRANSACAO = {} as Knex.Transaction;
const MUNICIPIO = { codigoIbge: 3530508, nome: 'Mococa', uf: 'SP' };
const CLIENTE = { id: 7, nome: 'Cliente Fictício', email: 'cliente@teste.invalid', telefone: '19900000000', cep: '13730000', aceite_em: new Date(), criado_em: new Date() };
const USINA: UsinaDoBanco = {
  id: 1, clienteId: 7, clienteNome: 'Cliente Fictício', municipio: MUNICIPIO, kwp: new Decimal('5.500'), dataProtocolo: '2024-05-10', dataConexao: '2024-06-20',
  intervaloLimpezaMeses: 6, status: 'ativa',
};
const NOVA_USINA = { clienteId: 7, codigoIbge: 3530508, kwp: 5.5, dataProtocolo: '2024-05-10', dataConexao: '2024-06-20', intervaloLimpezaMeses: 6 };
const MODULO: EquipamentoDaUsina = {
  id: 10, tipo: 'modulo', marca: 'Marca A', modelo: 'M550', numeroSerie: 'SERIE-1', quantidade: 1, dataInstalacao: '2023-03-15', garantiaProdutoMeses: 144, garantiaDesempenhoAnos: 25,
};
const INVERSOR: EquipamentoDaUsina = {
  id: 11, tipo: 'inversor', marca: 'Marca B', modelo: 'I5K', numeroSerie: 'SERIE-2', quantidade: 1, dataInstalacao: '2024-01-31', garantiaProdutoMeses: 1, garantiaDesempenhoAnos: null,
};
const { id: _idDoModulo, quantidade: _quantidadeDoModulo, ...NOVO_MODULO } = MODULO;
const { id: _idDoInversor, quantidade: _quantidadeDoInversor, garantiaDesempenhoAnos: _garantiaDoInversor, ...NOVO_INVERSOR } = INVERSOR;
const MENSAGEM_DO_VENCIMENTO = 'O vencimento desta garantia passa do ano 9999. Confira o valor.';

const ROTAS: ['get' | 'post' | 'patch', string][] = [
  ['get', '/api/admin/usinas'],
  ['get', '/api/admin/usinas/municipios?busca=mo'],
  ['post', '/api/admin/usinas'],
  ['get', '/api/admin/usinas/1'],
  ['patch', '/api/admin/usinas/1'],
  ['post', '/api/admin/usinas/1/desativar'],
  ['post', '/api/admin/usinas/1/equipamentos'],
  ['patch', '/api/admin/usinas/1/equipamentos/10'],
];

const pedir = (metodo: 'get' | 'post' | 'patch', rota: string, corpo?: object) => {
  const pedido = request(criarApp())[metodo](rota).set('Cookie', ADMIN);
  return corpo ? pedido.send(corpo) : pedido;
};

function esperarEntradaInvalida(resposta: request.Response, campo: string): void {
  expect(resposta.status).toBe(400);
  expect(resposta.body.error.code).toBe('ENTRADA_INVALIDA');
  expect(resposta.body.error.fields).toHaveProperty(campo);
}

function esperarNadaGravado(): void {
  expect(inserirUsina).not.toHaveBeenCalled();
  expect(atualizarUsina).not.toHaveBeenCalled();
  expect(inserirEquipamentoDaUsina).not.toHaveBeenCalled();
  expect(atualizarEquipamentoDaUsina).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarClientePorId).mockImplementation(async (id) => (id === 7 ? CLIENTE : undefined));
  vi.mocked(buscarMunicipio).mockImplementation(async (codigo) => (codigo === MUNICIPIO.codigoIbge ? MUNICIPIO : undefined));
  vi.mocked(buscarUsinaPorId).mockImplementation(async (id) => (id === 1 ? USINA : undefined));
  vi.mocked(listarEquipamentosDaUsina).mockResolvedValue([MODULO, INVERSOR]);
  vi.mocked(listarUsinas).mockResolvedValue({ usinas: [USINA], total: 1 });
  vi.mocked(buscarMunicipiosPorNome).mockResolvedValue([MUNICIPIO]);
  vi.mocked(inserirUsina).mockResolvedValue(1);
  vi.mocked(atualizarUsina).mockResolvedValue(undefined);
  // Usinas 1 e 2 existem; a transação simulada só entrega a usina travada à ação do service.
  vi.mocked(comUsinaTravada).mockImplementation(async (id, acao) => acao(
    id === 1 || id === 2 ? { id, dataProtocolo: USINA.dataProtocolo, dataConexao: USINA.dataConexao } : undefined,
    TRANSACAO,
  ));
  vi.mocked(existeSerieNaUsina).mockResolvedValue(false);
  vi.mocked(inserirEquipamentoDaUsina).mockResolvedValue(MODULO);
  vi.mocked(atualizarEquipamentoDaUsina).mockResolvedValue(MODULO);
  vi.mocked(buscarEquipamentoDaUsina).mockImplementation(async (_transacao, usinaId, id) => {
    if (usinaId !== 1) return undefined;
    return [MODULO, INVERSOR].find((equipamento) => equipamento.id === id);
  });
});

// Todas as rotas exigem sessão e papel admin, sem afetar rotas fora do módulo.
describe('acesso às rotas de usinas', () => {
  it.each(ROTAS)('%s %s: sem login → 401, sem papel admin → 403', async (metodo, rota) => {
    const semLogin = await request(criarApp())[metodo](rota);
    expect(semLogin.status).toBe(401);
    expect(semLogin.body.error.code).toBe('NAO_AUTENTICADO');

    const semPapel = await request(criarApp())[metodo](rota).set('Cookie', USUARIO);
    expect(semPapel.status).toBe(403);
    expect(semPapel.body.error.code).toBe('SEM_PERMISSAO');
  });

  it('não exige login em rotas fora do módulo: rota inexistente continua 404 sem cookie', async () => {
    expect((await request(criarApp()).get('/api/rota-que-nao-existe')).status).toBe(404);
  });
});

// Só ativas, paginação e limites da query.
describe('GET /api/admin/usinas', () => {
  it('pede só as ativas, pagina de 20 em 20 e devolve os campos da lista', async () => {
    const resposta = await pedir('get', '/api/admin/usinas');

    expect(listarUsinas).toHaveBeenCalledWith({ status: 'ativa', busca: undefined, pagina: 1, porPagina: 20 });
    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({
      usinas: [{
        id: 1, clienteId: 7, clienteNome: 'Cliente Fictício', municipio: MUNICIPIO, kwp: 5.5, regime: 'GD_II', dataProtocolo: '2024-05-10', dataConexao: '2024-06-20',
        intervaloLimpezaMeses: 6, status: 'ativa',
      }],
      pagina: 1, porPagina: 20, total: 1,
    });
  });

  it('busca com trim e limita porPagina=1000 a 100', async () => {
    const resposta = await pedir('get', '/api/admin/usinas?busca=%20maria%20&pagina=2&porPagina=1000');

    expect(listarUsinas).toHaveBeenCalledWith({ status: 'ativa', busca: 'maria', pagina: 2, porPagina: 100 });
    expect(resposta.body).toMatchObject({ pagina: 2, porPagina: 100 });
  });

  it('não aceita pedir usinas por status nem outro parâmetro desconhecido', async () => {
    esperarEntradaInvalida(await pedir('get', '/api/admin/usinas?status=desativada'), 'status');
    expect(listarUsinas).not.toHaveBeenCalled();
  });

  it('recusa caractere nulo na busca, que o banco não aceitaria', async () => {
    esperarEntradaInvalida(await pedir('get', '/api/admin/usinas?busca=a%00b'), 'busca');
  });
});

// A rota fixa não pode cair em /:id; limites da busca e da UF.
describe('GET /api/admin/usinas/municipios', () => {
  it('não confunde a rota com /:id e devolve os municípios', async () => {
    const resposta = await pedir('get', '/api/admin/usinas/municipios?busca=%20mo%20&uf=sp');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ municipios: [MUNICIPIO] });
    expect(buscarMunicipiosPorNome).toHaveBeenCalledWith({ busca: 'mo', uf: 'SP' });
    expect(buscarUsinaPorId).not.toHaveBeenCalled();
  });

  it.each(['', '?busca=', '?busca=m', '?busca=%20m%20'])('busca ausente ou com menos de 2 caracteres (%s) → 400', async (consulta) => {
    esperarEntradaInvalida(await pedir('get', `/api/admin/usinas/municipios${consulta}`), 'busca');
    expect(buscarMunicipiosPorNome).not.toHaveBeenCalled();
  });

  it.each(['?busca=mo&uf=S', '?busca=mo&uf=SPP', '?busca=mo&uf=1A'])('UF inválida (%s) → 400', async (consulta) => {
    esperarEntradaInvalida(await pedir('get', `/api/admin/usinas/municipios${consulta}`), 'uf');
  });
});

// Regime calculado, limites de kWp e datas, e referências inexistentes.
describe('POST /api/admin/usinas', () => {
  it('cria com kWp em Decimal e devolve o detalhe', async () => {
    const resposta = await pedir('post', '/api/admin/usinas', NOVA_USINA);

    expect(resposta.status).toBe(201);
    expect(resposta.body.usina).toMatchObject({ id: 1, cliente: { id: 7, nome: 'Cliente Fictício' }, municipio: MUNICIPIO, kwp: 5.5, regime: 'GD_II', status: 'ativa' });
    const dados = vi.mocked(inserirUsina).mock.calls[0][0];
    expect(dados.kwp).toBeInstanceOf(Decimal);
    expect(dados.kwp.toString()).toBe('5.5');
  });

  it.each([
    ['2023-01-07', 'GD_I'],
    ['2023-01-08', 'GD_II'],
  ])('protocolo em %s → regime %s na resposta', async (dataProtocolo, regime) => {
    vi.mocked(buscarUsinaPorId).mockResolvedValue({ ...USINA, dataProtocolo });

    const resposta = await pedir('post', '/api/admin/usinas', { ...NOVA_USINA, dataProtocolo });

    expect(resposta.status).toBe(201);
    expect(resposta.body.usina.regime).toBe(regime);
  });

  it('regime no body é ignorado: não chega ao repository e não muda o cálculo', async () => {
    const resposta = await pedir('post', '/api/admin/usinas', { ...NOVA_USINA, regime: 'GD_I' });

    expect(resposta.status).toBe(201);
    expect(resposta.body.usina.regime).toBe('GD_II');
    expect(vi.mocked(inserirUsina).mock.calls[0][0]).not.toHaveProperty('regime');
  });

  it.each([['outro'], ['status'], ['quantidade']])('campo desconhecido %s → 400', async (campo) => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas', { ...NOVA_USINA, [campo]: 1 }), campo);
    esperarNadaGravado();
  });

  it.each([
    ['negativo', -1],
    ['zero', 0],
    ['com 4 casas', 5.1234],
    ['acima de numeric(10,3)', 10_000_000],
    ['em texto', '5.5'],
  ])('kWp %s → 400', async (_descricao, kwp) => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas', { ...NOVA_USINA, kwp }), 'kwp');
    esperarNadaGravado();
  });

  it.each([[0.001], [5.123], [9_999_999.999]])('kWp %d é aceito', async (kwp) => {
    expect((await pedir('post', '/api/admin/usinas', { ...NOVA_USINA, kwp })).status).toBe(201);
  });

  it.each([[0], [3], [24], ['6']])('intervalo de limpeza %s → 400', async (intervaloLimpezaMeses) => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas', { ...NOVA_USINA, intervaloLimpezaMeses }), 'intervaloLimpezaMeses');
  });

  it.each(['2023-02-30', '2023-13-01', '10/05/2024', '2023-2-1', '0000-01-01', ''])('data inválida (%s) → 400', async (dataProtocolo) => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas', { ...NOVA_USINA, dataProtocolo }), 'dataProtocolo');
  });

  it('conexão anterior ao protocolo → 400; no mesmo dia é aceita', async () => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas', { ...NOVA_USINA, dataConexao: '2024-05-09' }), 'dataConexao');
    esperarNadaGravado();
    expect((await pedir('post', '/api/admin/usinas', { ...NOVA_USINA, dataConexao: '2024-05-10' })).status).toBe(201);
  });

  it('cliente e município inexistentes → 400 com os dois campos, sem gravar', async () => {
    const resposta = await pedir('post', '/api/admin/usinas', { ...NOVA_USINA, clienteId: 99, codigoIbge: 9999999 });

    esperarEntradaInvalida(resposta, 'clienteId');
    esperarEntradaInvalida(resposta, 'codigoIbge');
    esperarNadaGravado();
  });

  it.each([
    ['clienteId'],
    ['codigoIbge'],
  ] as const)('FK violada em corrida (%s) vira o mesmo 400', async (campoInexistente) => {
    vi.mocked(inserirUsina).mockResolvedValue({ campoInexistente });

    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas', NOVA_USINA), campoInexistente);
  });
});

// Formato do detalhe, inclusive de usina desativada, e ids inválidos.
describe('GET /api/admin/usinas/:id', () => {
  it('devolve cliente, município, regime, status e equipamentos com vencimentos', async () => {
    const resposta = await pedir('get', '/api/admin/usinas/1');

    expect(resposta.status).toBe(200);
    expect(resposta.body.usina).toEqual({
      id: 1, cliente: { id: 7, nome: 'Cliente Fictício' }, municipio: MUNICIPIO, kwp: 5.5, regime: 'GD_II', dataProtocolo: '2024-05-10', dataConexao: '2024-06-20',
      intervaloLimpezaMeses: 6, status: 'ativa',
      equipamentos: [
        { ...MODULO, vencimentoGarantiaProduto: '2035-03-15', vencimentoGarantiaDesempenho: '2048-03-15' },
        { ...INVERSOR, vencimentoGarantiaProduto: '2024-02-29', vencimentoGarantiaDesempenho: null },
      ],
    });
  });

  it('usina desativada também responde 200', async () => {
    vi.mocked(buscarUsinaPorId).mockResolvedValue({ ...USINA, status: 'desativada' });

    const resposta = await pedir('get', '/api/admin/usinas/1');

    expect(resposta.status).toBe(200);
    expect(resposta.body.usina.status).toBe('desativada');
    expect(resposta.body.usina.equipamentos).toHaveLength(2);
  });

  it('usina inexistente → 404 USINA_NAO_ENCONTRADA', async () => {
    const resposta = await pedir('get', '/api/admin/usinas/99');

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('USINA_NAO_ENCONTRADA');
  });

  it.each(['abc', '0', '-1', '2147483648'])('id inválido (%s) → 400', async (id) => {
    esperarEntradaInvalida(await pedir('get', `/api/admin/usinas/${id}`), 'id');
    expect(buscarUsinaPorId).not.toHaveBeenCalled();
  });
});

// Campos combinados com os valores atuais, recusas sem gravação e edição de usina desativada.
describe('PATCH /api/admin/usinas/:id', () => {
  it('altera em transação com a linha travada e passa só o que mudou', async () => {
    const resposta = await pedir('patch', '/api/admin/usinas/1', { kwp: 7.25 });

    expect(resposta.status).toBe(200);
    expect(comUsinaTravada).toHaveBeenCalledWith(1, expect.any(Function));
    const [transacao, id, mudanca] = vi.mocked(atualizarUsina).mock.calls[0];
    expect(transacao).toBe(TRANSACAO);
    expect(id).toBe(1);
    expect(mudanca.kwp).toEqual(new Decimal('7.25'));
    expect(mudanca.dataProtocolo).toBeUndefined();
  });

  it('regime no body é ignorado', async () => {
    const resposta = await pedir('patch', '/api/admin/usinas/1', { kwp: 7.25, regime: 'GD_I' });

    expect(resposta.status).toBe(200);
    expect(resposta.body.usina.regime).toBe('GD_II');
    expect(vi.mocked(atualizarUsina).mock.calls[0][2]).not.toHaveProperty('regime');
  });

  it.each([
    ['corpo vazio', {}],
    ['só regime', { regime: 'GD_I' }],
  ])('sem campo aplicável (%s) → 400', async (_descricao, corpo) => {
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1', corpo), 'corpo');
    esperarNadaGravado();
  });

  it.each([['status', 'desativada'], ['outro', 1], ['quantidade', 2]])('campo %s não é aceito → 400', async (campo, valor) => {
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1', { [campo]: valor }), campo);
    esperarNadaGravado();
  });

  it('kWp negativo e kWp com 4 casas → 400', async () => {
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1', { kwp: -1 }), 'kwp');
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1', { kwp: 1.2345 }), 'kwp');
    esperarNadaGravado();
  });

  it.each([
    ['conexão nova antes do protocolo atual', { dataConexao: '2024-05-09' }],
    ['protocolo novo depois da conexão atual', { dataProtocolo: '2024-06-21' }],
    ['as duas novas e invertidas', { dataProtocolo: '2025-01-02', dataConexao: '2025-01-01' }],
  ])('combinado: %s → 400', async (_descricao, corpo) => {
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1', corpo), 'dataConexao');
    esperarNadaGravado();
  });

  it('combinado: as duas datas novas e coerentes são aceitas', async () => {
    const resposta = await pedir('patch', '/api/admin/usinas/1', { dataProtocolo: '2025-01-01', dataConexao: '2025-02-01' });

    expect(resposta.status).toBe(200);
  });

  it('cliente e município inexistentes → 400; FK em corrida → o mesmo 400', async () => {
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1', { clienteId: 99 }), 'clienteId');
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1', { codigoIbge: 9999999 }), 'codigoIbge');
    esperarNadaGravado();

    vi.mocked(atualizarUsina).mockResolvedValue({ campoInexistente: 'clienteId' });
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1', { clienteId: 7 }), 'clienteId');
  });

  it('usina inexistente → 404, mesmo com a referência também inválida', async () => {
    const resposta = await pedir('patch', '/api/admin/usinas/99', { clienteId: 99 });

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('USINA_NAO_ENCONTRADA');
  });

  it('usina desativada não é bloqueada', async () => {
    vi.mocked(buscarUsinaPorId).mockResolvedValue({ ...USINA, status: 'desativada' });

    const resposta = await pedir('patch', '/api/admin/usinas/1', { intervaloLimpezaMeses: 12 });

    expect(resposta.status).toBe(200);
    expect(atualizarUsina).toHaveBeenCalledOnce();
    expect(resposta.body.usina.status).toBe('desativada');
  });
});

// Desativar só muda o status, e repetir o pedido continua respondendo 200.
describe('POST /api/admin/usinas/:id/desativar', () => {
  it('chama só a atualização de status', async () => {
    vi.mocked(buscarUsinaPorId).mockResolvedValue({ ...USINA, status: 'desativada' });

    const resposta = await pedir('post', '/api/admin/usinas/1/desativar');

    expect(resposta.status).toBe(200);
    expect(resposta.body.usina.status).toBe('desativada');
    expect(marcarUsinaComoDesativada).toHaveBeenCalledExactlyOnceWith(1);
    esperarNadaGravado();
  });

  it('desativar de novo responde 200 e continua sem outra gravação', async () => {
    vi.mocked(buscarUsinaPorId).mockResolvedValue({ ...USINA, status: 'desativada' });

    expect((await pedir('post', '/api/admin/usinas/1/desativar')).status).toBe(200);
    expect((await pedir('post', '/api/admin/usinas/1/desativar')).status).toBe(200);

    esperarNadaGravado();
  });

  it('usina inexistente → 404', async () => {
    const resposta = await pedir('post', '/api/admin/usinas/99/desativar');

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('USINA_NAO_ENCONTRADA');
  });
});

// Quantidade 1, garantias por tipo, vencimento até o ano 9999 e série sem repetição dentro da usina.
describe('POST /api/admin/usinas/:id/equipamentos', () => {
  it('chega ao repository com quantidade 1 e devolve os vencimentos', async () => {
    const resposta = await pedir('post', '/api/admin/usinas/1/equipamentos', NOVO_MODULO);

    expect(resposta.status).toBe(201);
    expect(inserirEquipamentoDaUsina).toHaveBeenCalledExactlyOnceWith(TRANSACAO, 1, { ...NOVO_MODULO, quantidade: 1 });
    expect(resposta.body.equipamento).toEqual({ ...MODULO, vencimentoGarantiaProduto: '2035-03-15', vencimentoGarantiaDesempenho: '2048-03-15' });
  });

  it('inversor sem garantia de desempenho é aceito e fica com null', async () => {
    vi.mocked(inserirEquipamentoDaUsina).mockResolvedValue(INVERSOR);

    const resposta = await pedir('post', '/api/admin/usinas/1/equipamentos', NOVO_INVERSOR);

    expect(resposta.status).toBe(201);
    expect(inserirEquipamentoDaUsina).toHaveBeenCalledWith(TRANSACAO, 1, { ...NOVO_INVERSOR, garantiaDesempenhoAnos: null, quantidade: 1 });
    expect(resposta.body.equipamento.vencimentoGarantiaDesempenho).toBeNull();
  });

  it('quantidade no body → 400', async () => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_MODULO, quantidade: 2 }), 'quantidade');
    esperarNadaGravado();
  });

  it.each(['regime', 'outro'])('campo desconhecido %s → 400', async (campo) => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_MODULO, [campo]: 'x' }), campo);
    esperarNadaGravado();
  });

  it('módulo sem garantia de desempenho → 400', async () => {
    const { garantiaDesempenhoAnos: _garantia, ...semGarantia } = NOVO_MODULO;

    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', semGarantia), 'garantiaDesempenhoAnos');
    esperarNadaGravado();
  });

  it('inversor com garantia de desempenho → 400', async () => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_INVERSOR, garantiaDesempenhoAnos: 10 }), 'garantiaDesempenhoAnos');
    esperarNadaGravado();
  });

  it.each([
    ['módulo', NOVO_MODULO],
    ['inversor', NOVO_INVERSOR],
  ])('%s com garantia de desempenho null → 400: null só vale no PATCH', async (_descricao, equipamento) => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', { ...equipamento, garantiaDesempenhoAnos: null }), 'garantiaDesempenhoAnos');
    esperarNadaGravado();
  });

  it.each([['vazio', ''], ['só com espaços', '   ']])('numeroSerie %s → 400', async (_descricao, numeroSerie) => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_MODULO, numeroSerie }), 'numeroSerie');
    esperarNadaGravado();
  });

  it.each([
    ['marca', 81],
    ['modelo', 121],
    ['numeroSerie', 101],
  ])('%s acima de %i caracteres → 400', async (campo, tamanho) => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_MODULO, [campo]: 'x'.repeat(tamanho) }), campo);
  });

  it.each([['garantiaProdutoMeses', 0], ['garantiaProdutoMeses', 1.5], ['garantiaDesempenhoAnos', -1], ['garantiaProdutoMeses', 2_147_483_648]])('%s = %d → 400', async (campo, valor) => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_MODULO, [campo]: valor }), campo);
  });

  it('recusa caractere nulo no texto, que o banco não aceitaria', async () => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_MODULO, marca: 'a\u0000b' }), 'marca');
  });

  it('data de instalação inválida → 400', async () => {
    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_MODULO, dataInstalacao: '2023-02-30' }), 'dataInstalacao');
  });

  it.each([
    ['de produto', { garantiaProdutoMeses: 96_000 }, 'garantiaProdutoMeses'],
    ['de desempenho', { garantiaDesempenhoAnos: 8_000 }, 'garantiaDesempenhoAnos'],
    ['de produto, no maior inteiro aceito', { garantiaProdutoMeses: 2_147_483_647 }, 'garantiaProdutoMeses'],
    ['de desempenho, no maior inteiro aceito', { garantiaDesempenhoAnos: 2_147_483_647 }, 'garantiaDesempenhoAnos'],
  ])('vencimento %s acima do ano 9999 → 400 só no campo certo, sem gravar', async (_descricao, garantia, campo) => {
    const resposta = await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_MODULO, ...garantia });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.fields).toEqual({ [campo]: MENSAGEM_DO_VENCIMENTO });
    esperarNadaGravado();
  });

  it('vencimento acima do ano 9999 vem junto com os demais campos inválidos', async () => {
    vi.mocked(existeSerieNaUsina).mockResolvedValue(true);

    const resposta = await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_MODULO, garantiaProdutoMeses: 96_000 });

    expect(resposta.body.error.fields).toEqual({ garantiaProdutoMeses: MENSAGEM_DO_VENCIMENTO, numeroSerie: expect.any(String) });
    esperarNadaGravado();
  });

  it('inversor com garantia de desempenho enorme recebe a recusa pelo tipo', async () => {
    const resposta = await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_INVERSOR, garantiaDesempenhoAnos: 8_000 });

    expect(resposta.body.error.fields).toEqual({ garantiaDesempenhoAnos: 'Só módulo tem garantia de desempenho.' });
    esperarNadaGravado();
  });

  it('vencimento em dezembro de 9999 é aceito', async () => {
    const resposta = await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_INVERSOR, dataInstalacao: '9999-11-30', garantiaProdutoMeses: 1 });

    expect(resposta.status).toBe(201);
    expect(inserirEquipamentoDaUsina).toHaveBeenCalledOnce();
  });

  it('usina inexistente → 404 antes de conferir o vencimento', async () => {
    const resposta = await pedir('post', '/api/admin/usinas/99/equipamentos', { ...NOVO_MODULO, garantiaProdutoMeses: 96_000 });

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('USINA_NAO_ENCONTRADA');
  });

  it('confere a série depois do trim, dentro da usina travada', async () => {
    await pedir('post', '/api/admin/usinas/1/equipamentos', { ...NOVO_MODULO, numeroSerie: '  SERIE-1  ' });

    expect(comUsinaTravada).toHaveBeenCalledWith(1, expect.any(Function));
    expect(existeSerieNaUsina).toHaveBeenCalledExactlyOnceWith(TRANSACAO, 1, 'SERIE-1', undefined);
  });

  it('série já usada na mesma usina → 400; a mesma série em outra usina é aceita', async () => {
    vi.mocked(existeSerieNaUsina).mockImplementation(async (_transacao, usinaId, numeroSerie) => usinaId === 1 && numeroSerie === 'SERIE-1');

    esperarEntradaInvalida(await pedir('post', '/api/admin/usinas/1/equipamentos', NOVO_MODULO), 'numeroSerie');
    expect(inserirEquipamentoDaUsina).not.toHaveBeenCalled();

    expect((await pedir('post', '/api/admin/usinas/2/equipamentos', NOVO_MODULO)).status).toBe(201);
    expect(vi.mocked(inserirEquipamentoDaUsina).mock.calls[0][1]).toBe(2);
  });

  it('usina inexistente → 404 USINA_NAO_ENCONTRADA', async () => {
    const resposta = await pedir('post', '/api/admin/usinas/99/equipamentos', NOVO_MODULO);

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('USINA_NAO_ENCONTRADA');
    esperarNadaGravado();
  });
});

// O pedido é combinado com o equipamento atual, e null limpa a garantia de desempenho.
describe('PATCH /api/admin/usinas/:id/equipamentos/:equipamentoId', () => {
  it('altera parcialmente, sem tocar na quantidade', async () => {
    const resposta = await pedir('patch', '/api/admin/usinas/1/equipamentos/10', { marca: '  Marca C  ' });

    expect(resposta.status).toBe(200);
    expect(atualizarEquipamentoDaUsina).toHaveBeenCalledExactlyOnceWith(TRANSACAO, 1, 10, { marca: 'Marca C' });
    expect(existeSerieNaUsina).not.toHaveBeenCalled();
  });

  it('quantidade no body → 400', async () => {
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1/equipamentos/10', { quantidade: 2 }), 'quantidade');
    esperarNadaGravado();
  });

  it('sem campo aplicável → 400', async () => {
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1/equipamentos/10', {}), 'corpo');
    esperarNadaGravado();
  });

  it('numeroSerie só com espaços → 400', async () => {
    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1/equipamentos/10', { numeroSerie: '   ' }), 'numeroSerie');
    esperarNadaGravado();
  });

  it('série de outro equipamento da usina → 400', async () => {
    vi.mocked(existeSerieNaUsina).mockResolvedValue(true);

    esperarEntradaInvalida(await pedir('patch', '/api/admin/usinas/1/equipamentos/10', { numeroSerie: 'SERIE-2' }), 'numeroSerie');
    esperarNadaGravado();
  });

  it('mantendo a própria série é aceito: a conferência ignora o próprio equipamento', async () => {
    const resposta = await pedir('patch', '/api/admin/usinas/1/equipamentos/10', { numeroSerie: 'SERIE-1' });

    expect(resposta.status).toBe(200);
    expect(existeSerieNaUsina).toHaveBeenCalledExactlyOnceWith(TRANSACAO, 1, 'SERIE-1', 10);
  });

  it.each([
    ['módulo sem a garantia', 10, { garantiaDesempenhoAnos: null }],
    ['módulo vira inversor mantendo a garantia', 10, { tipo: 'inversor' }],
    ['inversor recebe a garantia', 11, { garantiaDesempenhoAnos: 10 }],
    ['inversor vira módulo sem a garantia', 11, { tipo: 'modulo' }],
  ])('combinado: %s → 400', async (_descricao, equipamentoId, corpo) => {
    esperarEntradaInvalida(await pedir('patch', `/api/admin/usinas/1/equipamentos/${equipamentoId}`, corpo), 'garantiaDesempenhoAnos');
    esperarNadaGravado();
  });

  it.each([
    ['módulo vira inversor limpando a garantia', 10, { tipo: 'inversor', garantiaDesempenhoAnos: null }],
    ['inversor vira módulo com a garantia', 11, { tipo: 'modulo', garantiaDesempenhoAnos: 25 }],
  ])('combinado: %s é aceito', async (_descricao, equipamentoId, corpo) => {
    expect((await pedir('patch', `/api/admin/usinas/1/equipamentos/${equipamentoId}`, corpo)).status).toBe(200);
  });

  it.each([
    ['só a garantia de produto', 10, { garantiaProdutoMeses: 96_000 }, ['garantiaProdutoMeses']],
    ['só a garantia de desempenho', 10, { garantiaDesempenhoAnos: 8_000 }, ['garantiaDesempenhoAnos']],
    ['só a data, com as duas garantias atuais', 10, { dataInstalacao: '9999-12-01' }, ['garantiaProdutoMeses', 'garantiaDesempenhoAnos']],
    ['só a data, passando só a garantia de desempenho atual', 10, { dataInstalacao: '9980-01-01' }, ['garantiaDesempenhoAnos']],
    ['só a data, passando também pelos 144 meses de produto atuais', 10, { dataInstalacao: '9990-01-01' }, ['garantiaProdutoMeses', 'garantiaDesempenhoAnos']],
    ['só a data, em inversor sem garantia de desempenho', 11, { dataInstalacao: '9999-12-01' }, ['garantiaProdutoMeses']],
    ['data e garantia novas que só passam juntas', 10, { dataInstalacao: '9000-01-01', garantiaProdutoMeses: 12_000 }, ['garantiaProdutoMeses']],
  ])('vencimento combinado acima do ano 9999: %s → 400 no campo certo, sem gravar', async (_descricao, equipamentoId, corpo, campos) => {
    const resposta = await pedir('patch', `/api/admin/usinas/1/equipamentos/${equipamentoId}`, corpo);

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.fields).toEqual(Object.fromEntries(campos.map((campo) => [campo, MENSAGEM_DO_VENCIMENTO])));
    esperarNadaGravado();
  });

  it('vencimento acima do ano 9999 vem junto com os demais campos inválidos', async () => {
    vi.mocked(existeSerieNaUsina).mockResolvedValue(true);

    const resposta = await pedir('patch', '/api/admin/usinas/1/equipamentos/10', { numeroSerie: 'SERIE-2', garantiaProdutoMeses: 96_000 });

    expect(resposta.body.error.fields).toEqual({ garantiaProdutoMeses: MENSAGEM_DO_VENCIMENTO, numeroSerie: expect.any(String) });
    esperarNadaGravado();
  });

  it('só a garantia, somada à data atual já alta: 7 meses → 400 sem gravar; 6 meses é aceito', async () => {
    vi.mocked(buscarEquipamentoDaUsina).mockResolvedValue({ ...INVERSOR, dataInstalacao: '9999-06-15' });

    const recusa = await pedir('patch', '/api/admin/usinas/1/equipamentos/11', { garantiaProdutoMeses: 7 });
    expect(recusa.status).toBe(400);
    expect(recusa.body.error.fields).toEqual({ garantiaProdutoMeses: MENSAGEM_DO_VENCIMENTO });
    esperarNadaGravado();

    expect((await pedir('patch', '/api/admin/usinas/1/equipamentos/11', { garantiaProdutoMeses: 6 })).status).toBe(200);
  });

  it('inversor com garantia de desempenho enorme recebe a recusa pelo tipo', async () => {
    const resposta = await pedir('patch', '/api/admin/usinas/1/equipamentos/11', { garantiaDesempenhoAnos: 8_000 });

    expect(resposta.body.error.fields).toEqual({ garantiaDesempenhoAnos: 'Só módulo tem garantia de desempenho.' });
    esperarNadaGravado();
  });

  it.each([
    ['garantia de produto normal', 10, { garantiaProdutoMeses: 240 }],
    ['garantia de desempenho normal', 10, { garantiaDesempenhoAnos: 30 }],
    ['data normal', 10, { dataInstalacao: '2024-01-15' }],
    ['só a data, com vencimento em dezembro de 9999', 11, { dataInstalacao: '9999-11-30' }],
    ['data alta com garantia nova que cabe', 11, { dataInstalacao: '9999-01-15', garantiaProdutoMeses: 6 }],
    ['garantia de desempenho limpa, que passaria com a data nova', 10, { tipo: 'inversor', garantiaDesempenhoAnos: null, dataInstalacao: '9990-01-01', garantiaProdutoMeses: 12 }],
  ])('vencimento combinado que cabe: %s é aceito', async (_descricao, equipamentoId, corpo) => {
    const resposta = await pedir('patch', `/api/admin/usinas/1/equipamentos/${equipamentoId}`, corpo);

    expect(resposta.status).toBe(200);
    expect(atualizarEquipamentoDaUsina).toHaveBeenCalledExactlyOnceWith(TRANSACAO, 1, equipamentoId, corpo);
  });

  it.each([
    ['usina inexistente', 99, 'USINA_NAO_ENCONTRADA'],
    ['equipamento de outra usina', 2, 'EQUIPAMENTO_DA_USINA_NAO_ENCONTRADO'],
  ])('%s → 404 antes de conferir o vencimento', async (_descricao, usinaId, codigo) => {
    const resposta = await pedir('patch', `/api/admin/usinas/${usinaId}/equipamentos/10`, { garantiaProdutoMeses: 96_000 });

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe(codigo);
  });

  it('equipamento de outra usina → 404, sem gravar', async () => {
    const resposta = await pedir('patch', '/api/admin/usinas/2/equipamentos/10', { marca: 'Marca C' });

    expect(buscarEquipamentoDaUsina).toHaveBeenCalledWith(TRANSACAO, 2, 10);
    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('EQUIPAMENTO_DA_USINA_NAO_ENCONTRADO');
    esperarNadaGravado();
  });

  it('usina inexistente → 404 USINA_NAO_ENCONTRADA', async () => {
    const resposta = await pedir('patch', '/api/admin/usinas/99/equipamentos/10', { marca: 'Marca C' });

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('USINA_NAO_ENCONTRADA');
  });
});

// Texto exato de cada recusa: o texto técnico do validador não pode chegar à tela.
describe('mensagens dos campos', () => {
  type Caso = [descricao: string, metodo: 'get' | 'post' | 'patch', rota: string, corpo: object | undefined, campo: string, mensagem: string];
  interface RotasDoCorpo { post: string; patch: string; corpoValido: Record<string, unknown> }

  const ROTAS_DA_USINA: RotasDoCorpo = { post: '/api/admin/usinas', patch: '/api/admin/usinas/1', corpoValido: NOVA_USINA };
  const ROTAS_DO_EQUIPAMENTO: RotasDoCorpo = { post: '/api/admin/usinas/1/equipamentos', patch: '/api/admin/usinas/1/equipamentos/10', corpoValido: NOVO_MODULO };
  const INTEIROS_INVALIDOS = [null, '7', 1.5, 0, -1, 2_147_483_648, 1e20];
  const POTENCIAS_INVALIDAS = [null, '5.5', true, 0, -1, 10_000_000];
  const TEXTOS_INVALIDOS = [null, 123];
  const MENSAGEM_DO_KWP = 'Informe a potência em kWp: maior que zero e até 9.999.999,999.';
  const MENSAGEM_DO_PRODUTO = 'Informe a garantia do produto em meses: número inteiro de 1 a 2.147.483.647.';
  const MENSAGEM_DO_DESEMPENHO = 'Informe a garantia de desempenho em anos: número inteiro de 1 a 2.147.483.647.';
  const MENSAGEM_DA_DATA = 'Use uma data válida no formato AAAA-MM-DD.';
  const MENSAGEM_DO_INTERVALO = 'Use 6 ou 12 meses.';
  const MUNICIPIOS = '/api/admin/usinas/municipios';

  const comoTexto = (valor: unknown) => (typeof valor === 'string' && valor.length > 20 ? `${valor.length} caracteres` : JSON.stringify(valor));
  const pedirCaso = ([, metodo, rota, corpo]: Caso) => pedir(metodo, rota, corpo);

  function casosDoCampo(rotas: RotasDoCorpo, campo: string, mensagem: string, valores: unknown[], { ausenteRecusado = true, nullRecusadoNoPatch = true } = {}): Caso[] {
    const { [campo]: _retirado, ...semOCampo } = rotas.corpoValido;
    return [
      ...valores.map((valor): Caso => [`POST ${campo} = ${comoTexto(valor)}`, 'post', rotas.post, { ...rotas.corpoValido, [campo]: valor }, campo, mensagem]),
      ...(ausenteRecusado ? [[`POST sem ${campo}`, 'post', rotas.post, semOCampo, campo, mensagem] as Caso] : []),
      ...valores
        .filter((valor) => nullRecusadoNoPatch || valor !== null)
        .map((valor): Caso => [`PATCH ${campo} = ${comoTexto(valor)}`, 'patch', rotas.patch, { [campo]: valor }, campo, mensagem]),
    ];
  }

  const LINHAS_DA_TABELA: Caso[] = [
    ...casosDoCampo(ROTAS_DA_USINA, 'clienteId', 'Escolha um cliente.', INTEIROS_INVALIDOS),
    ...casosDoCampo(ROTAS_DA_USINA, 'codigoIbge', 'Escolha um município.', INTEIROS_INVALIDOS),
    ...casosDoCampo(ROTAS_DA_USINA, 'kwp', MENSAGEM_DO_KWP, POTENCIAS_INVALIDAS),
    ...casosDoCampo(ROTAS_DO_EQUIPAMENTO, 'garantiaProdutoMeses', MENSAGEM_DO_PRODUTO, INTEIROS_INVALIDOS),
    ...casosDoCampo(ROTAS_DO_EQUIPAMENTO, 'garantiaDesempenhoAnos', MENSAGEM_DO_DESEMPENHO, INTEIROS_INVALIDOS, { ausenteRecusado: false, nullRecusadoNoPatch: false }),
    ...casosDoCampo(ROTAS_DO_EQUIPAMENTO, 'marca', 'Use no máximo 80 caracteres.', ['x'.repeat(81)], { ausenteRecusado: false }),
    ...casosDoCampo(ROTAS_DO_EQUIPAMENTO, 'modelo', 'Use no máximo 120 caracteres.', ['x'.repeat(121)], { ausenteRecusado: false }),
    ...casosDoCampo(ROTAS_DO_EQUIPAMENTO, 'numeroSerie', 'Use no máximo 100 caracteres.', ['x'.repeat(101)], { ausenteRecusado: false }),
    ...casosDoCampo(ROTAS_DO_EQUIPAMENTO, 'marca', 'Preencha este campo.', TEXTOS_INVALIDOS),
    ...casosDoCampo(ROTAS_DO_EQUIPAMENTO, 'modelo', 'Preencha este campo.', TEXTOS_INVALIDOS),
    ...casosDoCampo(ROTAS_DO_EQUIPAMENTO, 'numeroSerie', 'Preencha este campo.', TEXTOS_INVALIDOS),
    ['GET municípios sem busca', 'get', MUNICIPIOS, undefined, 'busca', 'Digite ao menos 2 caracteres.'],
    ['GET municípios com busca que não é texto', 'get', `${MUNICIPIOS}?busca=mo&busca=ca`, undefined, 'busca', 'Digite ao menos 2 caracteres.'],
    ['GET municípios com busca de 121 caracteres', 'get', `${MUNICIPIOS}?busca=${'x'.repeat(121)}`, undefined, 'busca', 'Use no máximo 120 caracteres.'],
    ['GET lista com busca de 121 caracteres', 'get', `/api/admin/usinas?busca=${'x'.repeat(121)}`, undefined, 'busca', 'Use no máximo 120 caracteres.'],
  ];

  function esperarSoEstaMensagem(resposta: request.Response, campo: string, mensagem: string): void {
    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('ENTRADA_INVALIDA');
    expect(resposta.body.error.fields).toEqual({ [campo]: mensagem });
    esperarNadaGravado();
  }

  it.each(LINHAS_DA_TABELA)('%s → mensagem exata', async (...caso) => {
    const [, , , , campo, mensagem] = caso;

    esperarSoEstaMensagem(await pedirCaso(caso), campo, mensagem);
    expect(listarUsinas).not.toHaveBeenCalled();
    expect(buscarMunicipiosPorNome).not.toHaveBeenCalled();
  });

  it('nenhuma resposta desses casos traz texto técnico do validador', async () => {
    for (const caso of LINHAS_DA_TABELA) {
      const resposta = await pedirCaso(caso);

      expect(JSON.stringify(resposta.body), caso[0]).not.toMatch(/esperava|undefined|nulo|demasiado/i);
    }
  });

  it.each([
    ['POST', 'post', ROTAS_DA_USINA.post],
    ['PATCH', 'patch', ROTAS_DA_USINA.patch],
  ] as const)('%s de usina com o formulário vazio, como o frontend envia', async (_descricao, metodo, rota) => {
    const resposta = await pedir(metodo, rota, { clienteId: null, codigoIbge: null, kwp: null, dataProtocolo: '', dataConexao: '', intervaloLimpezaMeses: null });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.fields).toEqual({
      clienteId: 'Escolha um cliente.', codigoIbge: 'Escolha um município.', kwp: MENSAGEM_DO_KWP, dataProtocolo: MENSAGEM_DA_DATA, dataConexao: MENSAGEM_DA_DATA, intervaloLimpezaMeses: MENSAGEM_DO_INTERVALO,
    });
    esperarNadaGravado();
  });

  it('POST de usina sem nenhum campo recebe as mesmas mensagens', async () => {
    const resposta = await pedir('post', ROTAS_DA_USINA.post, {});

    expect(resposta.body.error.fields).toEqual({
      clienteId: 'Escolha um cliente.', codigoIbge: 'Escolha um município.', kwp: MENSAGEM_DO_KWP, dataProtocolo: MENSAGEM_DA_DATA, dataConexao: MENSAGEM_DA_DATA, intervaloLimpezaMeses: MENSAGEM_DO_INTERVALO,
    });
  });

  it('formulário de módulo vazio, como o frontend envia: POST recusa o null da garantia de desempenho; PATCH o aceita', async () => {
    const vazio = { tipo: 'modulo', marca: '', modelo: '', numeroSerie: '', dataInstalacao: '', garantiaProdutoMeses: null, garantiaDesempenhoAnos: null };
    const camposDoPatch = {
      marca: 'Preencha este campo.', modelo: 'Preencha este campo.', numeroSerie: 'Preencha este campo.', dataInstalacao: MENSAGEM_DA_DATA, garantiaProdutoMeses: MENSAGEM_DO_PRODUTO,
    };

    const noPost = await pedir('post', ROTAS_DO_EQUIPAMENTO.post, vazio);
    expect(noPost.body.error.fields).toEqual({ ...camposDoPatch, garantiaDesempenhoAnos: MENSAGEM_DO_DESEMPENHO });

    const noPatch = await pedir('patch', ROTAS_DO_EQUIPAMENTO.patch, vazio);
    expect(noPatch.body.error.fields).toEqual(camposDoPatch);
    esperarNadaGravado();
  });

  it.each<Caso>([
    ['POST kwp com 4 casas', 'post', ROTAS_DA_USINA.post, { ...NOVA_USINA, kwp: 5.1234 }, 'kwp', 'Use até 3 casas decimais.'],
    ['PATCH kwp com 4 casas', 'patch', ROTAS_DA_USINA.patch, { kwp: 5.1234 }, 'kwp', 'Use até 3 casas decimais.'],
    ['POST marca só com espaços', 'post', ROTAS_DO_EQUIPAMENTO.post, { ...NOVO_MODULO, marca: '   ' }, 'marca', 'Preencha este campo.'],
    ['PATCH numeroSerie vazio', 'patch', ROTAS_DO_EQUIPAMENTO.patch, { numeroSerie: '' }, 'numeroSerie', 'Preencha este campo.'],
    ['POST modelo com caractere nulo', 'post', ROTAS_DO_EQUIPAMENTO.post, { ...NOVO_MODULO, modelo: 'a\u0000b' }, 'modelo', 'Caractere inválido.'],
    ['GET lista com caractere nulo', 'get', '/api/admin/usinas?busca=a%00b', undefined, 'busca', 'Caractere inválido.'],
    ['GET municípios com caractere nulo', 'get', `${MUNICIPIOS}?busca=a%00b`, undefined, 'busca', 'Caractere inválido.'],
    ['POST data impossível', 'post', ROTAS_DA_USINA.post, { ...NOVA_USINA, dataProtocolo: '2023-02-30' }, 'dataProtocolo', MENSAGEM_DA_DATA],
    ['PATCH data null', 'patch', ROTAS_DA_USINA.patch, { dataConexao: null }, 'dataConexao', MENSAGEM_DA_DATA],
    ['POST instalação no ano 0000', 'post', ROTAS_DO_EQUIPAMENTO.post, { ...NOVO_MODULO, dataInstalacao: '0000-01-01' }, 'dataInstalacao', MENSAGEM_DA_DATA],
    ['POST intervalo 3', 'post', ROTAS_DA_USINA.post, { ...NOVA_USINA, intervaloLimpezaMeses: 3 }, 'intervaloLimpezaMeses', MENSAGEM_DO_INTERVALO],
    ['GET UF com 1 letra', 'get', `${MUNICIPIOS}?busca=mo&uf=S`, undefined, 'uf', 'Use a sigla da UF, com 2 letras.'],
    ['GET municípios com 1 caractere', 'get', `${MUNICIPIOS}?busca=m`, undefined, 'busca', 'Digite ao menos 2 caracteres.'],
    ['GET municípios com busca vazia', 'get', `${MUNICIPIOS}?busca=`, undefined, 'busca', 'Digite ao menos 2 caracteres.'],
    ['POST módulo sem garantia de desempenho', 'post', ROTAS_DO_EQUIPAMENTO.post, (({ garantiaDesempenhoAnos: _garantia, ...resto }) => resto)(NOVO_MODULO), 'garantiaDesempenhoAnos', 'Informe a garantia de desempenho do módulo.'],
    ['PATCH módulo limpando a garantia de desempenho', 'patch', ROTAS_DO_EQUIPAMENTO.patch, { garantiaDesempenhoAnos: null }, 'garantiaDesempenhoAnos', 'Informe a garantia de desempenho do módulo.'],
    ['POST inversor com garantia de desempenho', 'post', ROTAS_DO_EQUIPAMENTO.post, { ...NOVO_INVERSOR, garantiaDesempenhoAnos: 10 }, 'garantiaDesempenhoAnos', 'Só módulo tem garantia de desempenho.'],
    ['POST conexão anterior ao protocolo', 'post', ROTAS_DA_USINA.post, { ...NOVA_USINA, dataConexao: '2024-05-09' }, 'dataConexao', 'A data de conexão não pode ser anterior à data de protocolo.'],
    ['POST vencimento acima do ano 9999', 'post', ROTAS_DO_EQUIPAMENTO.post, { ...NOVO_MODULO, garantiaProdutoMeses: 96_000 }, 'garantiaProdutoMeses', MENSAGEM_DO_VENCIMENTO],
  ])('continua igual: %s', async (...caso) => {
    const [, , , , campo, mensagem] = caso;

    esperarSoEstaMensagem(await pedirCaso(caso), campo, mensagem);
  });

  it('continua igual: série repetida', async () => {
    vi.mocked(existeSerieNaUsina).mockResolvedValue(true);

    esperarSoEstaMensagem(await pedir('post', ROTAS_DO_EQUIPAMENTO.post, NOVO_MODULO), 'numeroSerie', 'Já existe um equipamento com este número de série nesta usina.');
  });

  it('garantia de desempenho no PATCH: null continua válido, e sem o campo ela não é alterada', async () => {
    expect((await pedir('patch', '/api/admin/usinas/1/equipamentos/11', { garantiaDesempenhoAnos: null })).status).toBe(200);
    expect(atualizarEquipamentoDaUsina).toHaveBeenLastCalledWith(TRANSACAO, 1, 11, { garantiaDesempenhoAnos: null });

    expect((await pedir('patch', '/api/admin/usinas/1/equipamentos/11', { marca: 'Marca C' })).status).toBe(200);
    expect(vi.mocked(atualizarEquipamentoDaUsina).mock.lastCall?.[3]).not.toHaveProperty('garantiaDesempenhoAnos');
  });
});
