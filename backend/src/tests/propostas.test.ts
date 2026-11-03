import { Decimal } from 'decimal.js';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { buscarClientePorId } from '../repositories/clientesRepository.ts';
import { atualizarEquipamento, inserirEquipamento, type EquipamentoDoCatalogo } from '../repositories/equipamentosRepository.ts';
import { buscarUltimoIndicador } from '../repositories/indicadoresRepository.ts';
import { buscarIrradiacaoDoMunicipio } from '../repositories/irradiacaoRepository.ts';
import {
  atualizarStatusDaProposta, buscarProposta, gravarPropostaComPrecosDoCatalogo, listarPropostas, type PropostaGravada,
} from '../repositories/propostasRepository.ts';
import { buscarSimulacaoPorCodigo } from '../repositories/simulacoesRepository.ts';
import { buscarTarifaVigente } from '../repositories/tarifasRepository.ts';
import { gerarToken } from '../services/authService.ts';
import { hojeEmSaoPaulo, somarDias } from '../utils/datas.ts';

vi.mock('../repositories/clientesRepository.ts', () => ({ buscarClientePorId: vi.fn() }));
vi.mock('../repositories/equipamentosRepository.ts', () => ({ listarEquipamentos: vi.fn(), inserirEquipamento: vi.fn(), atualizarEquipamento: vi.fn() }));
vi.mock('../repositories/indicadoresRepository.ts', () => ({ buscarUltimoIndicador: vi.fn() }));
vi.mock('../repositories/irradiacaoRepository.ts', () => ({ buscarIrradiacaoDoMunicipio: vi.fn() }));
vi.mock('../repositories/municipiosRepository.ts', () => ({ buscarMunicipio: vi.fn(async () => ({ codigoIbge: 3530508, nome: 'Mococa', uf: 'SP' })) }));
vi.mock('../repositories/propostasRepository.ts', () => ({
  gravarPropostaComPrecosDoCatalogo: vi.fn(), buscarProposta: vi.fn(), atualizarStatusDaProposta: vi.fn(), listarPropostas: vi.fn(),
}));
vi.mock('../repositories/simulacoesRepository.ts', () => ({ buscarSimulacaoPorCodigo: vi.fn() }));
vi.mock('../repositories/tarifasRepository.ts', () => ({ buscarTarifaVigente: vi.fn() }));

const ADMIN = `sessao=${gerarToken({ id: 1, papel: 'admin' })}`;
const CODIGO = 'a1f811c5-cd03-45d1-b9aa-f107b9eefb47';
const HSP_MOCOCA = ['5.099', '5.569', '5.31', '5.47', '5', '4.881', '5.072', '5.76', '5.326', '5.407', '5.252', '5.251'];
const TARIFA_B1 = {
  id: 41, subgrupo: 'B1', modalidade: 'Convencional', classe: 'Residencial', subclasse: 'Residencial',
  te: new Decimal('0.25219'), tusd: new Decimal('0.56039'), fioB: new Decimal('0.272853'), inicioVigencia: '2026-04-22', fimVigencia: '2027-04-21',
};
const MARIA = { id: 7, nome: 'Maria', email: 'maria@exemplo.com', telefone: '19999990000', cep: '13730250', aceite_em: new Date(), criado_em: new Date() };
const SIMULACAO = {
  id: 3, cliente_id: 7, codigo_ibge: 3530508,
  entrada: { pedido: { cep: '13730250', tipoLigacao: 'monofasico', subgrupo: 'B1', consumoMedioKwh: '400' } },
  resultado: { local: { cidade: 'Mococa', uf: 'SP' } },
};

function equipamento(dados: Partial<EquipamentoDoCatalogo>): EquipamentoDoCatalogo {
  return { id: 1, tipo: 'modulo', fabricante: 'Fabricante', modelo: 'M', potenciaW: new Decimal(550), degradacaoAnual: null, preco: new Decimal(700), ativo: true, ...dados };
}

// Catálogo "do banco": a proposta lê dele dentro da transação.
let catalogo: EquipamentoDoCatalogo[];
let gravadas: PropostaGravada[];

beforeEach(() => {
  vi.clearAllMocks();
  catalogo = [
    equipamento({ id: 1 }),
    equipamento({ id: 2, tipo: 'inversor', modelo: 'I3', potenciaW: new Decimal(3000), preco: new Decimal(3500) }),
  ];
  gravadas = [];
  vi.mocked(buscarSimulacaoPorCodigo).mockImplementation(async (codigo) => (codigo === CODIGO ? SIMULACAO : undefined));
  vi.mocked(buscarClientePorId).mockResolvedValue(MARIA);
  vi.mocked(buscarTarifaVigente).mockResolvedValue(TARIFA_B1);
  vi.mocked(buscarIrradiacaoDoMunicipio).mockResolvedValue({ id: 7, hspAnual: new Decimal('5.283'), hspMensal: HSP_MOCOCA.map((hsp) => new Decimal(hsp)) });
  vi.mocked(buscarUltimoIndicador).mockImplementation(async (serie) => ({ data: '2026-09-01', valor: new Decimal(serie === 432 ? '13.75' : '4.58') }));
  vi.mocked(gravarPropostaComPrecosDoCatalogo).mockImplementation(async ({ moduloId, inversorId }, montar) => {
    const proposta = montar(catalogo.find((item) => item.id === moduloId && item.ativo), catalogo.find((item) => item.id === inversorId && item.ativo));
    gravadas.push({ id: gravadas.length + 1, clienteId: proposta.clienteId, status: 'enviada', investimento: proposta.investimento, validaAte: proposta.validaAte, snapshot: JSON.parse(JSON.stringify(proposta.snapshot)), criadoEm: new Date() });
    return gravadas.length;
  });
  vi.mocked(buscarProposta).mockImplementation(async (id) => gravadas.find((proposta) => proposta.id === id));
});

const novaProposta = (corpo: object = { simulacao: CODIGO, moduloId: 1, inversorId: 2 }) =>
  request(criarApp()).post('/api/admin/propostas').set('Cookie', ADMIN).send(corpo);

describe('acesso', () => {
  it.each([
    ['get', '/api/admin/propostas'], ['post', '/api/admin/propostas'], ['get', '/api/admin/propostas/1'],
    ['patch', '/api/admin/propostas/1/status'], ['get', '/api/admin/equipamentos'], ['post', '/api/admin/equipamentos'],
  ] as const)('%s %s sem login → 401, sem papel admin → 403', async (metodo, rota) => {
    expect((await request(criarApp())[metodo](rota)).status).toBe(401);
    expect((await request(criarApp())[metodo](rota).set('Cookie', `sessao=${gerarToken({ id: 2, papel: 'usuario' })}`)).status).toBe(403);
  });
});

describe('POST /api/admin/propostas', () => {
  it('calcula o preço no backend: (módulos + inversor + instalação) × (1 + margem)', async () => {
    const resposta = await novaProposta();

    expect(resposta.status).toBe(201);
    const { proposta } = resposta.body;
    // 6 módulos × 700 + inversor 3.500 + 3,3 kWp × 700 de instalação = 10.010; com 20% de margem = 12.012.
    expect(proposta.precos).toEqual({ modulos: 4200, inversor: 3500, instalacao: 2310, margem: 2002, investimento: 12012 });
    expect(proposta.investimento).toBe(12012);
    expect(proposta.equipamentos.modulo).toMatchObject({ id: 1, quantidade: 6, preco: 700 });
    expect(proposta.equipamentos.inversor).toMatchObject({ id: 2, quantidade: 1, potenciaW: 3000 });
    expect(proposta.cliente).toEqual({ nome: 'Maria', email: 'maria@exemplo.com', telefone: '19999990000', cep: '13730250' });
    expect(proposta.status).toBe('enviada');
    expect(proposta.validaAte).toBe(somarDias(hojeEmSaoPaulo(new Date()), 10));
    expect(proposta.dimensionamento).toMatchObject({ numeroModulos: 6, kwpInstalado: 3.3, inversorKw: 3 });
    expect(proposta.indicadores.paybackSimplesAnos).toBeGreaterThan(0);
  });

  it('o resultado não traz a estimativa da simulação pública nem a entrada interna do motor', async () => {
    const { body } = await novaProposta();

    expect(body.proposta).not.toHaveProperty('investimentoEstimado');
    expect(body.proposta).not.toHaveProperty('entradaDoMotor');
    expect(gravadas[0].snapshot).toHaveProperty('entradaDoMotor');
  });

  it.each([
    ['preço enviado no body', { simulacao: CODIGO, moduloId: 1, inversorId: 2, investimento: 1 }, 'investimento'],
    ['simulação que não é código', { simulacao: '3', moduloId: 1, inversorId: 2 }, 'simulacao'],
    ['sem inversor', { simulacao: CODIGO, moduloId: 1 }, 'inversorId'],
  ])('%s → 400, sem gravar', async (_caso, corpo, campo) => {
    const resposta = await novaProposta(corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
    expect(gravarPropostaComPrecosDoCatalogo).not.toHaveBeenCalled();
  });

  it.each([
    ['inversor no lugar do módulo', { moduloId: 2, inversorId: 2 }],
    ['equipamento inativo', { moduloId: 1, inversorId: 2 }],
  ])('%s → 400 EQUIPAMENTO_INVALIDO, sem gravar', async (caso, ids) => {
    if (caso === 'equipamento inativo') catalogo[0].ativo = false;

    const resposta = await novaProposta({ simulacao: CODIGO, ...ids });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('EQUIPAMENTO_INVALIDO');
    expect(gravadas).toHaveLength(0);
  });

  it('simulação inexistente → 404; sem pedido de cliente → 422', async () => {
    expect((await novaProposta({ simulacao: 'b1f811c5-cd03-45d1-b9aa-f107b9eefb47', moduloId: 1, inversorId: 2 })).status).toBe(404);

    vi.mocked(buscarSimulacaoPorCodigo).mockResolvedValue({ ...SIMULACAO, cliente_id: null });
    const semCliente = await novaProposta();
    expect(semCliente.status).toBe(422);
    expect(semCliente.body.error.code).toBe('SIMULACAO_SEM_CLIENTE');
  });
});

describe('GET /api/admin/propostas/:id', () => {
  it('mudar a tarifa e o preço depois e reabrir a proposta → valores iguais', async () => {
    const emitida = (await novaProposta()).body.proposta;
    catalogo[0].preco = new Decimal(9999);
    vi.mocked(buscarTarifaVigente).mockResolvedValue({ ...TARIFA_B1, te: new Decimal('0.9') });
    vi.mocked(buscarTarifaVigente).mockClear();

    const reaberta = (await request(criarApp()).get('/api/admin/propostas/1').set('Cookie', ADMIN)).body.proposta;

    expect(reaberta).toEqual(emitida);
    expect(buscarTarifaVigente).not.toHaveBeenCalled();
  });

  it('proposta inexistente → 404', async () => {
    const resposta = await request(criarApp()).get('/api/admin/propostas/99').set('Cookie', ADMIN);

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('PROPOSTA_NAO_ENCONTRADA');
  });
});

describe('PATCH /api/admin/propostas/:id/status', () => {
  it('muda para aceita', async () => {
    await novaProposta();
    vi.mocked(atualizarStatusDaProposta).mockImplementation(async (id, status) => { gravadas[id - 1].status = status; return true; });

    const resposta = await request(criarApp()).patch('/api/admin/propostas/1/status').set('Cookie', ADMIN).send({ status: 'aceita' });

    expect(resposta.status).toBe(200);
    expect(resposta.body.proposta.status).toBe('aceita');
  });

  it('status inválido → 400', async () => {
    const resposta = await request(criarApp()).patch('/api/admin/propostas/1/status').set('Cookie', ADMIN).send({ status: 'cancelada' });

    expect(resposta.status).toBe(400);
    expect(atualizarStatusDaProposta).not.toHaveBeenCalled();
  });

  it('proposta inexistente → 404', async () => {
    vi.mocked(atualizarStatusDaProposta).mockResolvedValue(false);

    expect((await request(criarApp()).patch('/api/admin/propostas/99/status').set('Cookie', ADMIN).send({ status: 'recusada' })).status).toBe(404);
  });
});

describe('GET /api/admin/propostas', () => {
  it('filtra por status, pagina e marca as vencidas', async () => {
    vi.mocked(listarPropostas).mockResolvedValue({
      propostas: [{ id: 1, clienteId: 7, clienteNome: 'Maria', status: 'enviada', investimento: new Decimal('12012'), validaAte: '2020-01-10', criadoEm: new Date() }],
      total: 1,
    });

    const resposta = await request(criarApp()).get('/api/admin/propostas?status=enviada&porPagina=500').set('Cookie', ADMIN);

    expect(listarPropostas).toHaveBeenCalledWith({ status: 'enviada', pagina: 1, porPagina: 100 });
    expect(resposta.body.propostas[0]).toMatchObject({ id: 1, clienteNome: 'Maria', investimento: 12012, vencida: true });
  });
});

describe('catálogo de equipamentos', () => {
  const MODULO = { tipo: 'modulo', fabricante: 'Fabricante', modelo: 'M600', potenciaW: 600, degradacaoAnual: 0.004, preco: 780.5 };

  it('cadastra com o preço como Decimal', async () => {
    vi.mocked(inserirEquipamento).mockImplementation(async (dados) => equipamento({ id: 3, ...dados }));

    const resposta = await request(criarApp()).post('/api/admin/equipamentos').set('Cookie', ADMIN).send(MODULO);

    expect(resposta.status).toBe(201);
    expect(vi.mocked(inserirEquipamento).mock.calls[0][0].preco.toString()).toBe('780.5');
    expect(resposta.body.equipamento).toMatchObject({ id: 3, potenciaW: 600, degradacaoAnual: 0.004, preco: 780.5 });
  });

  it.each([
    ['módulo acima de 800 W', { ...MODULO, potenciaW: 900 }, 'potenciaW'],
    ['inversor com degradação', { ...MODULO, tipo: 'inversor', potenciaW: 5000 }, 'degradacaoAnual'],
    ['preço com 3 casas', { ...MODULO, preco: 10.123 }, 'preco'],
    ['preço negativo', { ...MODULO, preco: -1 }, 'preco'],
  ])('%s → 400', async (_caso, corpo, campo) => {
    const resposta = await request(criarApp()).post('/api/admin/equipamentos').set('Cookie', ADMIN).send(corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
  });

  it('duplicado → 409', async () => {
    vi.mocked(inserirEquipamento).mockResolvedValue(null);

    expect((await request(criarApp()).post('/api/admin/equipamentos').set('Cookie', ADMIN).send(MODULO)).status).toBe(409);
  });

  it('muda o preço; sem nada para mudar → 400; inexistente → 404', async () => {
    vi.mocked(atualizarEquipamento).mockImplementation(async (id, mudanca) => (id === 1 ? equipamento({ preco: mudanca.preco }) : undefined));
    const app = criarApp();

    expect((await request(app).patch('/api/admin/equipamentos/1').set('Cookie', ADMIN).send({ preco: 650 })).body.equipamento.preco).toBe(650);
    expect((await request(app).patch('/api/admin/equipamentos/1').set('Cookie', ADMIN).send({})).status).toBe(400);
    expect((await request(app).patch('/api/admin/equipamentos/9').set('Cookie', ADMIN).send({ ativo: false })).status).toBe(404);
  });
});
