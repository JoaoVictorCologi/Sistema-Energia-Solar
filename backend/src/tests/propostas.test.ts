import { Decimal } from 'decimal.js';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { buscarClientePorId, type ClienteResumo } from '../repositories/clientesRepository.ts';
import { buscarConfiguracaoComercial, buscarFormaDePagamento } from '../repositories/configuracoesRepository.ts';
import { atualizarEquipamento, inserirEquipamento, type EquipamentoDoCatalogo } from '../repositories/equipamentosRepository.ts';
import { buscarUltimoIndicador } from '../repositories/indicadoresRepository.ts';
import { buscarIrradiacaoDoMunicipio } from '../repositories/irradiacaoRepository.ts';
import {
  alterarRascunho, atualizarStatusDaProposta, buscarProposta, criarRascunho, excluirRascunho, listarEventos, listarPropostas, listarVersoes,
  type AjusteGravado, type CondicaoGravada, type EscolhasDaProposta, type EventoDaProposta, type Evento, type PropostaCalculada, type PropostaGravada,
} from '../repositories/propostasRepository.ts';
import { buscarSimulacaoPorCodigo, buscarSimulacaoPorId } from '../repositories/simulacoesRepository.ts';
import { buscarTarifaVigente } from '../repositories/tarifasRepository.ts';
import { gerarToken } from '../services/authService.ts';
import { hojeEmSaoPaulo, somarDias } from '../utils/datas.ts';
import { AVISTA, CARTAO, CONFIGURACAO_INICIAL, FINANCIAMENTO } from './apoio/comercialDeTeste.ts';

vi.mock('../repositories/usuariosRepository.ts', () => import('./apoio/usuariosDeTeste.ts'));
vi.mock('../repositories/clientesRepository.ts', () => ({ buscarClientePorId: vi.fn() }));
vi.mock('../repositories/configuracoesRepository.ts', () => ({ buscarConfiguracaoComercial: vi.fn(), buscarFormaDePagamento: vi.fn() }));
vi.mock('../repositories/equipamentosRepository.ts', () => ({ listarEquipamentos: vi.fn(async () => []), inserirEquipamento: vi.fn(), atualizarEquipamento: vi.fn() }));
vi.mock('../repositories/indicadoresRepository.ts', () => ({ buscarUltimoIndicador: vi.fn() }));
vi.mock('../repositories/irradiacaoRepository.ts', () => ({ buscarIrradiacaoDoMunicipio: vi.fn() }));
vi.mock('../repositories/municipiosRepository.ts', () => ({ buscarMunicipio: vi.fn(async () => ({ codigoIbge: 3530508, nome: 'Mococa', uf: 'SP' })) }));
vi.mock('../repositories/propostasRepository.ts', () => ({
  criarRascunho: vi.fn(), alterarRascunho: vi.fn(), buscarProposta: vi.fn(), atualizarStatusDaProposta: vi.fn(), excluirRascunho: vi.fn(),
  listarPropostas: vi.fn(), listarVersoes: vi.fn(), listarEventos: vi.fn(),
}));
vi.mock('../repositories/simulacoesRepository.ts', () => ({ buscarSimulacaoPorCodigo: vi.fn(), buscarSimulacaoPorId: vi.fn() }));
vi.mock('../repositories/tarifasRepository.ts', () => ({ buscarTarifaVigente: vi.fn() }));

const ADMIN = `sessao=${gerarToken({ id: 1, papel: 'admin' })}`;
const OPERADOR = `sessao=${gerarToken({ id: 2, papel: 'operador' })}`;
const GESTOR = `sessao=${gerarToken({ id: 3, papel: 'gestor' })}`;
const CODIGO = 'a1f811c5-cd03-45d1-b9aa-f107b9eefb47';
const HSP_MOCOCA = ['5.099', '5.569', '5.31', '5.47', '5', '4.881', '5.072', '5.76', '5.326', '5.407', '5.252', '5.251'];
const TARIFA_B1 = {
  id: 41, subgrupo: 'B1', modalidade: 'Convencional', classe: 'Residencial', subclasse: 'Residencial',
  te: new Decimal('0.25219'), tusd: new Decimal('0.56039'), fioB: new Decimal('0.272853'), inicioVigencia: '2026-04-22', fimVigencia: '2027-04-21',
};
const MARIA: ClienteResumo = {
  id: 7, nome: 'Maria', email: 'maria@exemplo.com', telefone: '19999990000', cep: '13730250', aceite_em: new Date(), criado_em: new Date(),
  logradouro: null, numero: null, complemento: null, bairro: null, contato_preferido: null, melhor_horario: null, autoriza_calibracao: false,
};
const SIMULACAO = {
  id: 3, cliente_id: 7, codigo_ibge: 3530508,
  entrada: { pedido: { cep: '13730250', tipoLigacao: 'monofasico', subgrupo: 'B1', consumoMedioKwh: '400' } },
  resultado: { local: { cidade: 'Mococa', uf: 'SP' } },
};

function equipamento(dados: Partial<EquipamentoDoCatalogo>): EquipamentoDoCatalogo {
  return { id: 1, tipo: 'modulo', fabricante: 'Fabricante', modelo: 'M', potenciaW: new Decimal(550), degradacaoAnual: null, preco: new Decimal(700), ativo: true, ...dados };
}

// O "banco": mesma regra do repository real (só o rascunho muda; erro no cálculo não grava nada).
interface PropostaNoBanco {
  proposta: PropostaGravada;
  ajustes: AjusteGravado[];
  condicoes: CondicaoGravada[];
  eventos: (EventoDaProposta & { usuarioId: number | null })[];
}

let catalogo: EquipamentoDoCatalogo[];
let banco: PropostaNoBanco[];
let proximoItem: number;

const noBanco = (id: number) => banco.find(({ proposta }) => proposta.id === id);
const comoEvento = ({ usuarioId, tipo, descricao, justificativa }: Evento) => ({ usuarioId, tipo, descricao, justificativa: justificativa ?? null, usuario: null, criadoEm: new Date() });
const comId = <T extends { id: number }>(itens: T[]) => itens.map((item) => ({ ...item, id: proximoItem++ }));

function calcularCom(calcular: (estado: never) => PropostaCalculada, escolhas: EscolhasDaProposta, ajustes: AjusteGravado[], condicoes: CondicaoGravada[]): PropostaCalculada {
  const ativo = (id: number) => catalogo.find((item) => item.id === id && item.ativo);
  return calcular({ escolhas, modulo: ativo(escolhas.moduloId), inversor: ativo(escolhas.inversorId), ajustes, condicoes } as never);
}

const colunasDoCalculo = ({ investimento, validaAte, snapshot }: PropostaCalculada) => ({ investimento, validaAte, snapshot: JSON.parse(JSON.stringify(snapshot)) as unknown });

function prepararBanco(): void {
  vi.mocked(criarRascunho).mockImplementation(async (dados, calcular) => {
    const origem = dados.copiarDe ? noBanco(dados.copiarDe) : undefined;
    const ajustes = comId(origem?.ajustes ?? []);
    const condicoes = comId(origem?.condicoes ?? []);
    const id = banco.length + 1;
    const calculada = calcularCom(calcular as never, dados.escolhas, ajustes, condicoes);
    banco.push({
      proposta: {
        id, clienteId: dados.clienteId, simulacaoId: dados.simulacaoId, status: 'rascunho', escolhas: dados.escolhas, versao: dados.versao, propostaRaizId: dados.raizId,
        observacoes: dados.observacoes, criadoEm: new Date(), ...colunasDoCalculo(calculada),
      },
      ajustes, condicoes, eventos: [comoEvento(dados.evento)],
    });
    return id;
  });
  vi.mocked(alterarRascunho).mockImplementation(async (id, mudanca, calcular) => {
    const atual = noBanco(id);
    if (!atual) return 'nao_encontrada';
    if (atual.proposta.status !== 'rascunho') return 'congelada';
    const ajustes = [...atual.ajustes, ...(mudanca.novoAjuste ? comId([{ ...mudanca.novoAjuste, id: 0 }]) : [])];
    const condicoes = [...atual.condicoes, ...(mudanca.novaCondicao ? comId([{ ...mudanca.novaCondicao, id: 0 }]) : [])];
    if (mudanca.removerAjusteId && !ajustes.some((item) => item.id === mudanca.removerAjusteId)) return 'item_nao_encontrado';
    if (mudanca.removerCondicaoId && !condicoes.some((item) => item.id === mudanca.removerCondicaoId)) return 'item_nao_encontrado';
    const novosAjustes = ajustes.filter((item) => item.id !== mudanca.removerAjusteId);
    const novasCondicoes = condicoes.filter((item) => item.id !== mudanca.removerCondicaoId);
    const escolhas = mudanca.escolhas ?? atual.proposta.escolhas;
    const calculada = calcularCom(calcular as never, escolhas, novosAjustes, novasCondicoes);
    atual.proposta = {
      ...atual.proposta, ...colunasDoCalculo(calculada), escolhas,
      ...(mudanca.observacoes !== undefined && { observacoes: mudanca.observacoes }), ...(mudanca.enviar && { status: 'enviada' as const }),
    };
    atual.ajustes = novosAjustes;
    atual.condicoes = novasCondicoes;
    atual.eventos.push(comoEvento(mudanca.evento));
    return 'alterada';
  });
  vi.mocked(buscarProposta).mockImplementation(async (id) => noBanco(id)?.proposta);
  vi.mocked(listarEventos).mockImplementation(async (id) => noBanco(id)?.eventos ?? []);
  vi.mocked(listarVersoes).mockImplementation(async (raizId) => banco
    .filter(({ proposta }) => proposta.id === raizId || proposta.propostaRaizId === raizId)
    .map(({ proposta: { id, versao, status, investimento, validaAte, criadoEm } }) => ({ id, versao, status, investimento, validaAte, criadoEm })));
  vi.mocked(atualizarStatusDaProposta).mockImplementation(async (id, status, evento) => {
    const atual = noBanco(id)!;
    atual.proposta.status = status;
    atual.eventos.push(comoEvento(evento));
  });
  vi.mocked(excluirRascunho).mockImplementation(async (id) => {
    if (noBanco(id)?.proposta.status !== 'rascunho') return false;
    banco = banco.filter(({ proposta }) => proposta.id !== id);
    return true;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  catalogo = [
    equipamento({ id: 1 }),
    equipamento({ id: 2, tipo: 'inversor', modelo: 'I3', potenciaW: new Decimal(3000), preco: new Decimal(3500) }),
    equipamento({ id: 3, modelo: 'M2', preco: new Decimal(800) }),
  ];
  banco = [];
  proximoItem = 1;
  prepararBanco();
  vi.mocked(buscarSimulacaoPorCodigo).mockImplementation(async (codigo) => (codigo === CODIGO ? SIMULACAO : undefined));
  vi.mocked(buscarSimulacaoPorId).mockImplementation(async (id) => (id === SIMULACAO.id ? SIMULACAO : undefined));
  vi.mocked(buscarClientePorId).mockResolvedValue(MARIA);
  vi.mocked(buscarTarifaVigente).mockResolvedValue(TARIFA_B1);
  vi.mocked(buscarIrradiacaoDoMunicipio).mockResolvedValue({ id: 7, hspAnual: new Decimal('5.283'), hspMensal: HSP_MOCOCA.map((hsp) => new Decimal(hsp)) });
  vi.mocked(buscarUltimoIndicador).mockImplementation(async (serie) => ({ data: '2026-09-01', valor: new Decimal(serie === 432 ? '13.75' : '4.58') }));
  vi.mocked(buscarConfiguracaoComercial).mockResolvedValue(CONFIGURACAO_INICIAL);
  vi.mocked(buscarFormaDePagamento).mockImplementation(async (id) => [AVISTA, CARTAO, FINANCIAMENTO].find((forma) => forma.id === id));
});

const novaProposta = (corpo: object = { simulacao: CODIGO, moduloId: 1, inversorId: 2 }) =>
  request(criarApp()).post('/api/admin/propostas').set('Cookie', OPERADOR).send(corpo);
const comoOperador = (metodo: 'post' | 'patch' | 'delete' | 'get', rota: string, corpo?: object) =>
  request(criarApp())[metodo](`/api/admin/propostas/${rota}`).set('Cookie', OPERADOR).send(corpo);
const enviada = async () => {
  await novaProposta();
  await comoOperador('post', '1/condicoes', { formaPagamentoId: AVISTA.id });
  return (await comoOperador('post', '1/enviar')).body.proposta;
};

describe('acesso', () => {
  it.each([
    ['get', '/api/admin/propostas'], ['post', '/api/admin/propostas'], ['get', '/api/admin/propostas/1'], ['patch', '/api/admin/propostas/1'],
    ['delete', '/api/admin/propostas/1'], ['post', '/api/admin/propostas/1/ajustes'], ['delete', '/api/admin/propostas/1/ajustes/1'], ['post', '/api/admin/propostas/1/condicoes'],
    ['delete', '/api/admin/propostas/1/condicoes/1'], ['post', '/api/admin/propostas/1/enviar'], ['post', '/api/admin/propostas/1/nova-versao'], ['post', '/api/admin/propostas/1/duplicar'],
    ['patch', '/api/admin/propostas/1/status'], ['get', '/api/admin/equipamentos'], ['post', '/api/admin/equipamentos'],
  ] as const)('%s %s sem login → 401', async (metodo, rota) => {
    expect((await request(criarApp())[metodo](rota)).status).toBe(401);
  });

  it.each([['post', '/api/admin/equipamentos'], ['patch', '/api/admin/equipamentos/1']] as const)('%s %s: operador, sem gestão do catálogo → 403', async (metodo, rota) => {
    const resposta = await request(criarApp())[metodo](rota).set('Cookie', OPERADOR).send({ preco: 650 });

    expect(resposta.status).toBe(403);
    expect(atualizarEquipamento).not.toHaveBeenCalled();
    expect(inserirEquipamento).not.toHaveBeenCalled();
  });

  it('operador lê o catálogo e orça', async () => {
    expect((await request(criarApp()).get('/api/admin/equipamentos').set('Cookie', OPERADOR)).status).toBe(200);
    expect((await novaProposta()).status).toBe(201);
  });
});

describe('POST /api/admin/propostas', () => {
  it('calcula o preço no backend: (módulos + inversor + instalação) × (1 + margem)', async () => {
    const resposta = await novaProposta();

    expect(resposta.status).toBe(201);
    const { proposta } = resposta.body;
    // 6 módulos × 700 + inversor 3.500 + 3,3 kWp × 700 de instalação = 10.010; com 20% de margem = 12.012.
    expect(proposta.precos).toEqual({ modulos: 4200, inversor: 3500, instalacao: 2310, margem: 2002, calculado: 12012, ajustes: 0, investimento: 12012 });
    expect(proposta.investimento).toBe(12012);
    expect(proposta.equipamentos.modulo).toMatchObject({ id: 1, quantidade: 6, preco: 700 });
    expect(proposta.equipamentos.inversor).toMatchObject({ id: 2, quantidade: 1, potenciaW: 3000 });
    expect(proposta.cliente).toEqual({ nome: 'Maria', email: 'maria@exemplo.com', telefone: '19999990000', cep: '13730250' });
    expect(proposta.status).toBe('rascunho');
    expect(proposta.versao).toBe(1);
    expect(proposta.validaAte).toBe(somarDias(hojeEmSaoPaulo(new Date()), 10));
    expect(proposta.dimensionamento).toMatchObject({ numeroModulos: 6, kwpInstalado: 3.3, inversorKw: 3 });
    expect(proposta.indicadores.paybackSimplesAnos).toBeGreaterThan(0);
  });

  it('o resultado não traz a estimativa da simulação pública nem a entrada interna do motor', async () => {
    const { body } = await novaProposta();

    expect(body.proposta).not.toHaveProperty('investimentoEstimado');
    expect(body.proposta).not.toHaveProperty('entradaDoMotor');
    expect(banco[0].proposta.snapshot).toHaveProperty('entradaDoMotor');
  });

  it.each([
    ['preço enviado no body', { simulacao: CODIGO, moduloId: 1, inversorId: 2, investimento: 1 }, 'investimento'],
    ['simulação que não é código', { simulacao: '3', moduloId: 1, inversorId: 2 }, 'simulacao'],
    ['sem inversor', { simulacao: CODIGO, moduloId: 1 }, 'inversorId'],
  ])('%s → 400, sem gravar', async (_caso, corpo, campo) => {
    const resposta = await novaProposta(corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
    expect(criarRascunho).not.toHaveBeenCalled();
  });

  it.each([
    ['inversor no lugar do módulo', { moduloId: 2, inversorId: 2 }],
    ['equipamento inativo', { moduloId: 1, inversorId: 2 }],
  ])('%s → 400 EQUIPAMENTO_INVALIDO, sem gravar', async (caso, ids) => {
    if (caso === 'equipamento inativo') catalogo[0].ativo = false;

    const resposta = await novaProposta({ simulacao: CODIGO, ...ids });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('EQUIPAMENTO_INVALIDO');
    expect(banco).toHaveLength(0);
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
  it('mudar a tarifa, o preço e a configuração depois e reabrir a proposta enviada → valores iguais', async () => {
    const emitida = await enviada();
    catalogo[0].preco = new Decimal(9999);
    vi.mocked(buscarTarifaVigente).mockResolvedValue({ ...TARIFA_B1, te: new Decimal('0.9') });
    vi.mocked(buscarConfiguracaoComercial).mockResolvedValue({ ...CONFIGURACAO_INICIAL, margem: new Decimal('0.5') });
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

  it('o histórico diz quem fez o quê', async () => {
    await enviada();

    const { historico } = (await request(criarApp()).get('/api/admin/propostas/1').set('Cookie', ADMIN)).body.proposta;

    expect(historico.map((evento: { tipo: string }) => evento.tipo)).toEqual(['criada', 'condicao_adicionada', 'enviada']);
    expect(banco[0].eventos.every((evento) => evento.usuarioId === 2)).toBe(true);
  });
});

describe('PATCH /api/admin/propostas/:id/status', () => {
  const mudarStatus = (status: string, id = 1) => request(criarApp()).patch(`/api/admin/propostas/${id}/status`).set('Cookie', ADMIN).send({ status });

  it('muda para aceita', async () => {
    await enviada();

    const resposta = await mudarStatus('aceita');

    expect(resposta.status).toBe(200);
    expect(resposta.body.proposta.status).toBe('aceita');
  });

  it.each(['cancelada', 'rascunho'])('status inválido (%s) → 400', async (status) => {
    const resposta = await mudarStatus(status);

    expect(resposta.status).toBe(400);
    expect(atualizarStatusDaProposta).not.toHaveBeenCalled();
  });

  it('proposta inexistente → 404', async () => {
    expect((await mudarStatus('recusada', 99)).status).toBe(404);
  });

  it('rascunho precisa ser enviado antes → 409', async () => {
    await novaProposta();

    const resposta = await mudarStatus('aceita');

    expect(resposta.status).toBe(409);
    expect(resposta.body.error.code).toBe('PROPOSTA_EM_RASCUNHO');
  });

  it('vencida não pode ser aceita → 409, mas pode ser recusada', async () => {
    await enviada();
    banco[0].proposta.validaAte = '2020-01-10';

    const aceita = await mudarStatus('aceita');
    expect(aceita.status).toBe(409);
    expect(aceita.body.error.code).toBe('PROPOSTA_VENCIDA');

    const recusada = await mudarStatus('recusada');
    expect(recusada.status).toBe(200);
    expect(recusada.body.proposta).toMatchObject({ status: 'recusada', vencida: false });
  });

  it('vencida recusada não passa a aceita → 409, e o status não muda', async () => {
    await enviada();
    banco[0].proposta.validaAte = '2020-01-10';
    await mudarStatus('recusada');

    const aceita = await mudarStatus('aceita');

    expect(aceita.status).toBe(409);
    expect(aceita.body.error.code).toBe('PROPOSTA_VENCIDA');
    expect(banco[0].proposta.status).toBe('recusada');
  });

  it('vencida que volta a enviada também não pode ser aceita → 409', async () => {
    await enviada();
    await mudarStatus('recusada');
    banco[0].proposta.validaAte = '2020-01-10';
    await mudarStatus('enviada');

    const aceita = await mudarStatus('aceita');

    expect(aceita.status).toBe(409);
    expect(aceita.body.error.code).toBe('PROPOSTA_VENCIDA');
  });

  it('recusada dentro da validade ainda pode ser aceita', async () => {
    await enviada();
    await mudarStatus('recusada');

    const aceita = await mudarStatus('aceita');

    expect(aceita.status).toBe(200);
    expect(aceita.body.proposta.status).toBe('aceita');
  });

  it('aceita dentro da validade segue valendo depois de vencer', async () => {
    await enviada();
    await mudarStatus('aceita');
    banco[0].proposta.validaAte = '2020-01-10';

    const reconfirmada = await mudarStatus('aceita');

    expect(reconfirmada.status).toBe(200);
    expect(reconfirmada.body.proposta).toMatchObject({ status: 'aceita', vencida: false });
  });
});

describe('GET /api/admin/propostas', () => {
  const LINHA = { id: 1, clienteId: 7, clienteNome: 'Maria', status: 'enviada' as const, investimento: new Decimal('12012'), validaAte: '2020-01-10', versao: 2, criadoEm: new Date() };

  it('filtra por status, pagina e marca as vencidas', async () => {
    vi.mocked(listarPropostas).mockResolvedValue({ propostas: [LINHA], total: 1 });

    const resposta = await request(criarApp()).get('/api/admin/propostas?status=enviada&porPagina=500').set('Cookie', ADMIN);

    expect(listarPropostas).toHaveBeenCalledWith({ status: 'enviada', pagina: 1, porPagina: 100 });
    expect(resposta.body.propostas[0]).toMatchObject({ id: 1, clienteNome: 'Maria', investimento: 12012, vencida: true, versao: 2 });
  });

  it('o filtro "vencida" busca as enviadas com a validade passada', async () => {
    vi.mocked(listarPropostas).mockResolvedValue({ propostas: [], total: 0 });

    await request(criarApp()).get('/api/admin/propostas?status=vencida').set('Cookie', OPERADOR);

    expect(listarPropostas).toHaveBeenCalledWith({ vencidasEm: hojeEmSaoPaulo(new Date()), pagina: 1, porPagina: 20 });
  });

  it('aceita o filtro rascunho e recusa status desconhecido', async () => {
    vi.mocked(listarPropostas).mockResolvedValue({ propostas: [], total: 0 });

    expect((await request(criarApp()).get('/api/admin/propostas?status=rascunho').set('Cookie', OPERADOR)).status).toBe(200);
    expect((await request(criarApp()).get('/api/admin/propostas?status=cancelada').set('Cookie', OPERADOR)).status).toBe(400);
  });
});

describe('ajustes do orçamento', () => {
  const DESCONTO = { tipo: 'desconto', descricao: 'Fechamento na semana', modo: 'valor', valor: 1012 };

  it('total = calculado + ajustes: desconto em reais e acréscimo em percentual sobre o calculado', async () => {
    await novaProposta();

    await comoOperador('post', '1/ajustes', DESCONTO);
    const { proposta } = (await comoOperador('post', '1/ajustes', { tipo: 'acrescimo', descricao: 'Estrutura para laje', modo: 'percentual', valor: 0.05 })).body;

    expect(proposta.precos).toMatchObject({ calculado: 12012, ajustes: -411.4, investimento: 11600.6 });
    expect(proposta.investimento).toBe(11600.6);
    expect(proposta.ajustes.map((ajuste: { valorEmReais: number }) => ajuste.valorEmReais)).toEqual([-1012, 600.6]);
  });

  it('desconto até o limite do painel (10%) não pede justificativa', async () => {
    await novaProposta();

    const resposta = await comoOperador('post', '1/ajustes', { ...DESCONTO, modo: 'percentual', valor: 0.1 });

    expect(resposta.status).toBe(201);
    expect(resposta.body.proposta.investimento).toBe(10810.8);
  });

  it('desconto acima do limite sem justificativa → 400, sem gravar; com justificativa, passa e fica no histórico', async () => {
    await novaProposta();
    const acima = { ...DESCONTO, modo: 'percentual', valor: 0.11 };

    const recusado = await comoOperador('post', '1/ajustes', acima);
    expect(recusado.status).toBe(400);
    expect(recusado.body.error.code).toBe('JUSTIFICATIVA_OBRIGATORIA');
    expect(banco[0].ajustes).toHaveLength(0);

    const aceito = await comoOperador('post', '1/ajustes', { ...acima, justificativa: 'Cliente indicou outros dois vizinhos' });
    expect(aceito.status).toBe(201);
    expect(aceito.body.proposta.historico.at(-1)).toMatchObject({ tipo: 'ajuste_adicionado', justificativa: 'Cliente indicou outros dois vizinhos' });
  });

  it('a soma dos descontos também conta para o limite', async () => {
    await novaProposta();
    const metade = { ...DESCONTO, modo: 'percentual', valor: 0.06 };

    expect((await comoOperador('post', '1/ajustes', metade)).status).toBe(201);
    expect((await comoOperador('post', '1/ajustes', metade)).body.error.code).toBe('JUSTIFICATIVA_OBRIGATORIA');
  });

  it('ajuste que zera o orçamento → 400', async () => {
    await novaProposta();

    const resposta = await comoOperador('post', '1/ajustes', { ...DESCONTO, valor: 12012, justificativa: 'Não faz sentido' });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('VALOR_FINAL_INVALIDO');
  });

  it.each([
    ['percentual acima de 100%', { ...DESCONTO, modo: 'percentual', valor: 5 }, 'valor'],
    ['valor zero', { ...DESCONTO, valor: 0 }, 'valor'],
    ['tipo desconhecido', { ...DESCONTO, tipo: 'brinde' }, 'tipo'],
    ['sem descrição', { ...DESCONTO, descricao: '' }, 'descricao'],
    ['valor final enviado no body', { ...DESCONTO, investimento: 1 }, 'investimento'],
  ])('%s → 400', async (_caso, corpo, campo) => {
    await novaProposta();

    const resposta = await comoOperador('post', '1/ajustes', corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
  });

  it('remover o ajuste volta ao calculado; item de outro orçamento → 404', async () => {
    await novaProposta();
    const { ajustes } = (await comoOperador('post', '1/ajustes', DESCONTO)).body.proposta;

    expect((await comoOperador('delete', '1/ajustes/999')).body.error.code).toBe('ITEM_NAO_ENCONTRADO');
    expect((await comoOperador('delete', `1/ajustes/${ajustes[0].id}`)).body.proposta.investimento).toBe(12012);
  });
});

describe('condições de pagamento', () => {
  // R$ 2.012 de desconto deixa o valor final em R$ 10.000, o exemplo da tabela Price.
  const ateDezMil = async () => {
    await novaProposta();
    await comoOperador('post', '1/ajustes', { tipo: 'desconto', descricao: 'Campanha', modo: 'valor', valor: 2012, justificativa: 'Campanha de novembro' });
  };

  it('à vista aplica o desconto da forma', async () => {
    await novaProposta();

    const { condicoes } = (await comoOperador('post', '1/condicoes', { formaPagamentoId: AVISTA.id })).body.proposta;

    expect(condicoes[0]).toMatchObject({ nome: 'À vista', tipo: 'avista', parcelas: 1, entrada: 0, valorParcela: 11411.4, valorTotal: 11411.4, economiaMensalMenosParcela: null });
  });

  it('financiado calcula pela Price, com a entrada escolhida, e compara com a economia do mês', async () => {
    await ateDezMil();

    const { condicoes, indicadores } = (await comoOperador('post', '1/condicoes', { formaPagamentoId: FINANCIAMENTO.id, entrada: 1000, parcelas: 60 })).body.proposta;

    // R$ 9.000 a 1,5% em 60 meses = 228,54.
    expect(condicoes[0]).toMatchObject({ entrada: 1000, parcelas: 60, taxaMensal: 0.015, valorParcela: 228.54, valorTotal: 14712.4 });
    expect(condicoes[0].economiaMensalMenosParcela).toBeCloseTo(indicadores.economiaMensalMedia - 228.54, 1);
  });

  it('sem entrada informada, usa a mínima da forma; sem parcelas, o máximo', async () => {
    await ateDezMil();

    const { condicoes } = (await comoOperador('post', '1/condicoes', { formaPagamentoId: FINANCIAMENTO.id })).body.proposta;

    expect(condicoes[0]).toMatchObject({ entrada: 1000, parcelas: 120 });
  });

  it('parcelado sem juros divide por igual', async () => {
    await ateDezMil();

    const { condicoes } = (await comoOperador('post', '1/condicoes', { formaPagamentoId: CARTAO.id, parcelas: 10 })).body.proposta;

    expect(condicoes[0]).toMatchObject({ valorParcela: 1000, valorTotal: 10000 });
  });

  it('um novo desconto refaz a condição já escolhida', async () => {
    await novaProposta();
    await comoOperador('post', '1/condicoes', { formaPagamentoId: CARTAO.id, parcelas: 12 });

    const { condicoes } = (await comoOperador('post', '1/ajustes', { tipo: 'desconto', descricao: 'Campanha', modo: 'valor', valor: 12 })).body.proposta;

    expect(condicoes[0].valorParcela).toBe(1000);
  });

  it.each([
    ['parcelas acima da forma', { formaPagamentoId: FINANCIAMENTO.id, parcelas: 200 }, 'parcelas'],
    ['parcelas abaixo da forma', { formaPagamentoId: FINANCIAMENTO.id, parcelas: 6 }, 'parcelas'],
    ['carência acima da forma', { formaPagamentoId: FINANCIAMENTO.id, carenciaDias: 180 }, 'carenciaDias'],
    ['entrada abaixo da mínima', { formaPagamentoId: FINANCIAMENTO.id, entrada: 10 }, 'entrada'],
    ['entrada acima do valor final', { formaPagamentoId: FINANCIAMENTO.id, entrada: 20000 }, 'entrada'],
    ['forma inexistente', { formaPagamentoId: 99 }, 'formaPagamentoId'],
    ['valor da parcela enviado no body', { formaPagamentoId: AVISTA.id, valorParcela: 1 }, 'valorParcela'],
  ])('%s → 400, sem gravar', async (_caso, corpo, campo) => {
    await novaProposta();

    const resposta = await comoOperador('post', '1/condicoes', corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
    expect(banco[0].condicoes).toHaveLength(0);
  });

  it('forma desativada no painel → 400 FORMA_INVALIDA', async () => {
    await novaProposta();
    vi.mocked(buscarFormaDePagamento).mockResolvedValue({ ...CARTAO, ativa: false });

    const resposta = await comoOperador('post', '1/condicoes', { formaPagamentoId: CARTAO.id });

    expect(resposta.body.error.code).toBe('FORMA_INVALIDA');
  });

  it('remover a condição: inexistente → 404', async () => {
    await novaProposta();
    const { condicoes } = (await comoOperador('post', '1/condicoes', { formaPagamentoId: AVISTA.id })).body.proposta;

    expect((await comoOperador('delete', '1/condicoes/999')).status).toBe(404);
    expect((await comoOperador('delete', `1/condicoes/${condicoes[0].id}`)).body.proposta.condicoes).toEqual([]);
  });
});

describe('revisão do rascunho', () => {
  it('trocar equipamento ou premissa sem justificativa → 400', async () => {
    await novaProposta();

    const resposta = await comoOperador('patch', '1', { moduloId: 3 });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('JUSTIFICATIVA_OBRIGATORIA');
  });

  it('com justificativa, recalcula com o novo módulo e registra', async () => {
    await novaProposta();

    const { proposta } = (await comoOperador('patch', '1', { moduloId: 3, justificativa: 'Módulo em promoção acabou' })).body;

    expect(proposta.equipamentos.modulo).toMatchObject({ id: 3, preco: 800 });
    expect(proposta.precos.modulos).toBe(4800);
    expect(proposta.historico.at(-1)).toMatchObject({ tipo: 'revisao', justificativa: 'Módulo em promoção acabou' });
  });

  it('a quantidade de módulos revisada define o preço; a origem das premissas diz "revisado"', async () => {
    await novaProposta();

    const { proposta } = (await comoOperador('patch', '1', {
      revisao: { quantidadeDeModulos: 8, performanceRatio: 0.8, telhado: { orientacao: 'leste' } }, justificativa: 'Visita técnica',
    })).body;

    expect(proposta.dimensionamento.numeroModulos).toBe(8);
    expect(proposta.precos.modulos).toBe(5600);
    expect(proposta.revisao).toMatchObject({ quantidadeDeModulos: 8 });
    expect(proposta.premissas).toMatchObject({ performanceRatio: 0.8, telhado: { fator: 0.88 } });
    expect(proposta.premissas.origem).toMatchObject({ performanceRatio: 'revisado', telhado: 'revisado', simultaneidade: 'estimado' });
  });

  it.each([
    ['PR fora da faixa', { revisao: { performanceRatio: 0.95 }, justificativa: 'Teste' }, 'revisao.performanceRatio'],
    ['simultaneidade fora da faixa', { revisao: { simultaneidade: 0.9 }, justificativa: 'Teste' }, 'revisao.simultaneidade'],
    ['módulos zerados', { revisao: { quantidadeDeModulos: 0 }, justificativa: 'Teste' }, 'revisao.quantidadeDeModulos'],
    ['nada para mudar', {}, 'corpo'],
    ['preço enviado no body', { investimento: 1, observacoes: 'x' }, 'investimento'],
  ])('%s → 400', async (_caso, corpo, campo) => {
    await novaProposta();

    const resposta = await comoOperador('patch', '1', corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
  });

  it('observações não pedem justificativa nem mudam o valor', async () => {
    await novaProposta();

    const { proposta } = (await comoOperador('patch', '1', { observacoes: 'Ligar depois das 18h' })).body;

    expect(proposta).toMatchObject({ observacoes: 'Ligar depois das 18h', investimento: 12012 });
  });

  it('equipamento inativo na troca → 400, sem mudar o rascunho', async () => {
    await novaProposta();
    catalogo[2].ativo = false;

    const resposta = await comoOperador('patch', '1', { moduloId: 3, justificativa: 'Troca' });

    expect(resposta.body.error.code).toBe('EQUIPAMENTO_INVALIDO');
    expect(banco[0].proposta.escolhas.moduloId).toBe(1);
  });
});

describe('envio e versões', () => {
  it('enviar sem condição de pagamento → 422', async () => {
    await novaProposta();

    const resposta = await comoOperador('post', '1/enviar');

    expect(resposta.status).toBe(422);
    expect(resposta.body.error.code).toBe('PROPOSTA_SEM_CONDICAO');
  });

  it('enviar recalcula com o preço do dia e congela', async () => {
    await novaProposta();
    await comoOperador('post', '1/condicoes', { formaPagamentoId: AVISTA.id });
    catalogo[0].preco = new Decimal(800);

    const { proposta } = (await comoOperador('post', '1/enviar')).body;

    expect(proposta.status).toBe('enviada');
    expect(proposta.precos.modulos).toBe(4800);
  });

  it.each([
    ['editar', 'patch', '1', { observacoes: 'x' }],
    ['ajustar', 'post', '1/ajustes', { tipo: 'desconto', descricao: 'Campanha', modo: 'valor', valor: 10 }],
    ['incluir condição', 'post', '1/condicoes', { formaPagamentoId: CARTAO.id }],
    ['enviar de novo', 'post', '1/enviar', undefined],
    ['excluir', 'delete', '1', undefined],
  ] as const)('orçamento enviado não muda: %s → 409', async (_caso, metodo, rota, corpo) => {
    await enviada();

    const resposta = await comoOperador(metodo, rota, corpo);

    expect(resposta.status).toBe(409);
    expect(resposta.body.error.code).toBe('PROPOSTA_CONGELADA');
    expect(banco[0].proposta.investimento.toNumber()).toBe(12012);
  });

  it('nova versão copia ajustes e condições, usa os preços novos e não toca na anterior', async () => {
    await novaProposta();
    await comoOperador('post', '1/condicoes', { formaPagamentoId: AVISTA.id });
    await comoOperador('post', '1/ajustes', { tipo: 'desconto', descricao: 'Campanha', modo: 'valor', valor: 100 });
    const anterior = (await comoOperador('post', '1/enviar')).body.proposta;
    catalogo[0].preco = new Decimal(800);

    const resposta = await comoOperador('post', '1/nova-versao', {});

    expect(resposta.status).toBe(201);
    expect(resposta.body.proposta).toMatchObject({ id: 2, status: 'rascunho', versao: 2, propostaRaizId: 1 });
    expect(resposta.body.proposta.precos.modulos).toBe(4800);
    expect(resposta.body.proposta.ajustes).toHaveLength(1);
    expect(resposta.body.proposta.condicoes).toHaveLength(1);
    expect(resposta.body.proposta.versoes.map((versao: { versao: number; status: string }) => [versao.versao, versao.status])).toEqual([[1, 'enviada'], [2, 'rascunho']]);

    const reaberta = (await comoOperador('get', '1')).body.proposta;
    expect(reaberta.precos).toEqual(anterior.precos);
    expect(reaberta.status).toBe('enviada');
  });

  it('nova versão de um rascunho, ou com outro rascunho aberto → 409', async () => {
    await novaProposta();
    expect((await comoOperador('post', '1/nova-versao', {})).body.error.code).toBe('PROPOSTA_EM_RASCUNHO');

    await comoOperador('post', '1/condicoes', { formaPagamentoId: AVISTA.id });
    await comoOperador('post', '1/enviar');
    await comoOperador('post', '1/nova-versao', {});

    expect((await comoOperador('post', '1/nova-versao', {})).body.error.code).toBe('RASCUNHO_JA_EXISTE');
  });

  it('a versão de uma versão continua na mesma família', async () => {
    await enviada();
    await comoOperador('post', '1/nova-versao', {});
    await comoOperador('post', '2/enviar');

    const { proposta } = (await comoOperador('post', '2/nova-versao', {})).body;

    expect(proposta).toMatchObject({ versao: 3, propostaRaizId: 1 });
  });

  it('duplicar cria outro orçamento, na versão 1, e pode trocar o módulo', async () => {
    await enviada();

    const { proposta } = (await comoOperador('post', '1/duplicar', { moduloId: 3 })).body;

    expect(proposta).toMatchObject({ id: 2, status: 'rascunho', versao: 1, propostaRaizId: null });
    expect(proposta.equipamentos.modulo.id).toBe(3);
    expect(proposta.condicoes).toHaveLength(1);
  });

  it('excluir rascunho → 204; inexistente → 404', async () => {
    await novaProposta();

    expect((await comoOperador('delete', '1')).status).toBe(204);
    expect(banco).toHaveLength(0);
    expect((await comoOperador('delete', '99')).status).toBe(404);
  });

  it('a margem nova do painel vale só para os orçamentos seguintes', async () => {
    await enviada();
    vi.mocked(buscarConfiguracaoComercial).mockResolvedValue({ ...CONFIGURACAO_INICIAL, margem: new Decimal('0.25') });

    const nova = (await novaProposta()).body.proposta;

    expect(nova.investimento).toBe(12512.5);
    expect(nova.configuracaoUsada.margem).toBe(0.25);
    expect((await comoOperador('get', '1')).body.proposta.investimento).toBe(12012);
  });
});

describe('catálogo de equipamentos', () => {
  const MODULO = { tipo: 'modulo', fabricante: 'Fabricante', modelo: 'M600', potenciaW: 600, degradacaoAnual: 0.004, preco: 780.5 };

  it('cadastra com o preço como Decimal', async () => {
    vi.mocked(inserirEquipamento).mockImplementation(async (dados) => equipamento({ id: 3, ...dados }));

    const resposta = await request(criarApp()).post('/api/admin/equipamentos').set('Cookie', GESTOR).send(MODULO);

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
    const resposta = await request(criarApp()).post('/api/admin/equipamentos').set('Cookie', GESTOR).send(corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
  });

  it('duplicado → 409', async () => {
    vi.mocked(inserirEquipamento).mockResolvedValue(null);

    expect((await request(criarApp()).post('/api/admin/equipamentos').set('Cookie', GESTOR).send(MODULO)).status).toBe(409);
  });

  it('muda o preço; sem nada para mudar → 400; inexistente → 404', async () => {
    vi.mocked(atualizarEquipamento).mockImplementation(async (id, mudanca) => (id === 1 ? equipamento({ preco: mudanca.preco }) : undefined));
    const app = criarApp();

    expect((await request(app).patch('/api/admin/equipamentos/1').set('Cookie', GESTOR).send({ preco: 650 })).body.equipamento.preco).toBe(650);
    expect((await request(app).patch('/api/admin/equipamentos/1').set('Cookie', GESTOR).send({})).status).toBe(400);
    expect((await request(app).patch('/api/admin/equipamentos/9').set('Cookie', GESTOR).send({ ativo: false })).status).toBe(404);
  });
});
