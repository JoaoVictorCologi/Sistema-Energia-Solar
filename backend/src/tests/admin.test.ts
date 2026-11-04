import { Decimal } from 'decimal.js';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { buscarClientePorId, listarClientes, type ClienteResumo } from '../repositories/clientesRepository.ts';
import { listarUltimasImportacoes } from '../repositories/importacoesRepository.ts';
import { contarPropostasVencidas, contarTotais, somarAceitasDesde } from '../repositories/painelRepository.ts';
import { contarPropostasPorStatus, listarPropostas } from '../repositories/propostasRepository.ts';
import { listarSimulacoes, listarSimulacoesDoCliente } from '../repositories/simulacoesRepository.ts';
import { montarPainel } from '../services/adminService.ts';
import { gerarToken } from '../services/authService.ts';

vi.mock('../repositories/usuariosRepository.ts', () => import('./apoio/usuariosDeTeste.ts'));
vi.mock('../repositories/clientesRepository.ts', () => ({ buscarClientePorId: vi.fn(), listarClientes: vi.fn() }));
vi.mock('../repositories/importacoesRepository.ts', () => ({ listarUltimasImportacoes: vi.fn() }));
vi.mock('../repositories/painelRepository.ts', () => ({ contarTotais: vi.fn(), contarPropostasVencidas: vi.fn(), somarAceitasDesde: vi.fn() }));
vi.mock('../repositories/propostasRepository.ts', () => ({ contarPropostasPorStatus: vi.fn(), listarPropostas: vi.fn() }));
vi.mock('../repositories/simulacoesRepository.ts', () => ({ listarSimulacoesDoCliente: vi.fn(), listarSimulacoes: vi.fn() }));

const ADMIN = `sessao=${gerarToken({ id: 1, papel: 'admin' })}`;
const OPERADOR = `sessao=${gerarToken({ id: 2, papel: 'operador' })}`;
const CRIADO_EM = new Date('2026-11-03T12:00:00Z');
const MARIA: ClienteResumo = {
  id: 7, nome: 'Maria', email: 'maria@exemplo.com', telefone: '19999990000', cep: '13730250', aceite_em: CRIADO_EM, criado_em: CRIADO_EM,
  logradouro: 'Rua das Flores', numero: '120', complemento: null, bairro: 'Centro', contato_preferido: 'whatsapp', melhor_horario: 'tarde', autoriza_calibracao: true,
};
const RESULTADO_GRAVADO = {
  local: { cidade: 'Mococa', uf: 'SP' },
  pedido: { tipoLigacao: 'monofasico', subgrupo: 'B1', consumoMedioKwh: 400 },
  dimensionamento: { numeroModulos: 6, potenciaModuloW: 550, kwpInstalado: 3.3, inversorKw: 3 },
  investimentoEstimado: { valor: 13200, aviso: '…' },
  indicadores: { economiaMensalMedia: 352.28 },
  premissas: { distribuidora: 'CPFL Santa Cruz' },
};
const RESPOSTAS = { cep: '13730250', perfilDeConsumo: 'noite', telhado: { orientacao: 'norte', horasDeSol: 'de6a8' } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarClientes).mockResolvedValue({ clientes: [MARIA], total: 1 });
  vi.mocked(buscarClientePorId).mockImplementation(async (id) => (id === 7 ? MARIA : undefined));
  vi.mocked(listarSimulacoesDoCliente).mockResolvedValue([{ id: 3, codigo: 'a1f8', criado_em: CRIADO_EM, resultado: RESULTADO_GRAVADO, entrada: { pedido: RESPOSTAS, motor: {} } }]);
  vi.mocked(listarSimulacoes).mockResolvedValue({ simulacoes: [], total: 0 });
  vi.mocked(contarTotais).mockResolvedValue({ clientes: 4, simulacoes: 10, simulacoesComPedido: 4, pedidosNovos: 1 });
  vi.mocked(contarPropostasVencidas).mockResolvedValue(1);
  vi.mocked(somarAceitasDesde).mockResolvedValue(new Decimal('12012.5'));
  vi.mocked(listarUltimasImportacoes).mockResolvedValue([]);
  vi.mocked(contarPropostasPorStatus).mockResolvedValue({ rascunho: 3, enviada: 2, aceita: 1, recusada: 0 });
  vi.mocked(listarPropostas).mockResolvedValue({
    propostas: [{ id: 5, clienteId: 7, clienteNome: 'Maria', status: 'enviada', investimento: new Decimal('12012'), validaAte: '2026-11-13', versao: 1, criadoEm: CRIADO_EM }],
    total: 1,
  });
});

describe('acesso à área restrita', () => {
  it.each(['/api/admin/painel', '/api/admin/clientes', '/api/admin/clientes/7', '/api/admin/simulacoes'])('%s: sem login → 401; operador entra', async (rota) => {
    expect((await request(criarApp()).get(rota)).status).toBe(401);
    expect((await request(criarApp()).get(rota).set('Cookie', OPERADOR)).status).toBe(200);
  });
});

describe('GET /api/admin/painel', () => {
  it('traz as contagens, o funil e a última importação de tarifas', async () => {
    vi.mocked(listarUltimasImportacoes).mockResolvedValue([{
      id: 1, tipo: 'aneel-tarifas', status: 'sem_alteracao', iniciada_em: CRIADO_EM, finalizada_em: CRIADO_EM, versao_da_fonte: 'v', linhas_gravadas: 0, mensagem: null,
    }]);

    const resposta = await request(criarApp()).get('/api/admin/painel').set('Cookie', ADMIN);

    expect(resposta.body.painel).toEqual({
      clientes: 4, simulacoes: 10, simulacoesComPedido: 4, pedidosNovos: 1, propostasPorStatus: { rascunho: 3, enviada: 2, aceita: 1, recusada: 0 },
      propostasVencidas: 1, valorAceitoNoMes: 12012.5,
      ultimaImportacaoDeTarifas: { status: 'sem_alteracao', finalizadaEm: CRIADO_EM.toISOString() },
    });
  });

  it('soma as aceitas desde o dia 1º do mês em São Paulo', async () => {
    await montarPainel(new Date('2026-12-01T02:00:00Z')); // ainda 30/11 em São Paulo

    expect(somarAceitasDesde).toHaveBeenCalledWith('2026-11-01');
    expect(contarPropostasVencidas).toHaveBeenCalledWith('2026-11-30');
  });
});

describe('GET /api/admin/clientes', () => {
  it('pagina de 20 em 20 por padrão e devolve só os campos da lista', async () => {
    const resposta = await request(criarApp()).get('/api/admin/clientes').set('Cookie', ADMIN);

    expect(listarClientes).toHaveBeenCalledWith({ busca: undefined, pagina: 1, porPagina: 20 });
    expect(resposta.body).toEqual({
      clientes: [{ id: 7, nome: 'Maria', email: 'maria@exemplo.com', telefone: '19999990000', criadoEm: CRIADO_EM.toISOString() }],
      pagina: 1, porPagina: 20, total: 1,
    });
  });

  it('busca por nome ou e-mail e limita porPagina=1000 a 100', async () => {
    await request(criarApp()).get('/api/admin/clientes?busca=%20maria%20&pagina=2&porPagina=1000').set('Cookie', ADMIN);

    expect(listarClientes).toHaveBeenCalledWith({ busca: 'maria', pagina: 2, porPagina: 100 });
  });

  it.each(['pagina=0', 'pagina=abc', 'porPagina=-1', 'ordem=nome'])('?%s → 400', async (query) => {
    const resposta = await request(criarApp()).get(`/api/admin/clientes?${query}`).set('Cookie', ADMIN);

    expect(resposta.status).toBe(400);
    expect(listarClientes).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/clientes/:id', () => {
  it('traz contato, endereço e o resumo das simulações com as respostas do cliente', async () => {
    const resposta = await request(criarApp()).get('/api/admin/clientes/7').set('Cookie', ADMIN);

    expect(resposta.body.cliente).toEqual({
      id: 7, nome: 'Maria', email: 'maria@exemplo.com', telefone: '19999990000', cep: '13730250',
      criadoEm: CRIADO_EM.toISOString(), aceiteEm: CRIADO_EM.toISOString(), contatoPreferido: 'whatsapp', melhorHorario: 'tarde', autorizaUsoParaCalibracao: true,
      endereco: { logradouro: 'Rua das Flores', numero: '120', complemento: null, bairro: 'Centro' },
    });
    expect(resposta.body.simulacoes).toEqual([{
      codigo: 'a1f8', criadaEm: CRIADO_EM.toISOString(), cidade: 'Mococa', distribuidora: 'CPFL Santa Cruz', tipoLigacao: 'monofasico',
      consumoMedioKwh: 400, kwpInstalado: 3.3, investimentoEstimado: 13200, economiaMensalMedia: 352.28, respostas: RESPOSTAS,
    }]);
    expect(listarPropostas).toHaveBeenCalledWith({ clienteId: 7, pagina: 1, porPagina: 100 });
    expect(resposta.body.propostas).toEqual([{ id: 5, status: 'enviada', investimento: 12012, validaAte: '2026-11-13', vencida: expect.any(Boolean), criadoEm: CRIADO_EM.toISOString() }]);
  });

  it('cliente sem endereço informado → endereço nulo', async () => {
    vi.mocked(buscarClientePorId).mockResolvedValue({ ...MARIA, logradouro: null, numero: null, bairro: null });

    const resposta = await request(criarApp()).get('/api/admin/clientes/7').set('Cookie', ADMIN);

    expect(resposta.body.cliente.endereco).toBeNull();
  });

  it('id inexistente → 404', async () => {
    const resposta = await request(criarApp()).get('/api/admin/clientes/99').set('Cookie', ADMIN);

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('CLIENTE_NAO_ENCONTRADO');
  });

  it('id que não é número → 400', async () => {
    expect((await request(criarApp()).get('/api/admin/clientes/abc').set('Cookie', ADMIN)).status).toBe(400);
  });
});

describe('GET /api/admin/simulacoes', () => {
  it('lista com o cliente, quando houve pedido, e sem o resultado inteiro', async () => {
    vi.mocked(listarSimulacoes).mockResolvedValue({
      simulacoes: [
        { codigo: 'a1f8', criado_em: CRIADO_EM, resultado: RESULTADO_GRAVADO, cliente_id: 7, cidade: 'Mococa', uf: 'SP', cliente_nome: 'Maria' },
        { codigo: 'b2c9', criado_em: CRIADO_EM, resultado: RESULTADO_GRAVADO, cliente_id: null, cidade: 'Mococa', uf: 'SP', cliente_nome: null },
      ],
      total: 2,
    });

    const resposta = await request(criarApp()).get('/api/admin/simulacoes').set('Cookie', OPERADOR);

    expect(listarSimulacoes).toHaveBeenCalledWith({ pagina: 1, porPagina: 20 });
    expect(resposta.body).toMatchObject({ pagina: 1, porPagina: 20, total: 2 });
    expect(resposta.body.simulacoes[0]).toEqual({
      codigo: 'a1f8', criadaEm: CRIADO_EM.toISOString(), cidade: 'Mococa', uf: 'SP', distribuidora: 'CPFL Santa Cruz', tipoLigacao: 'monofasico', consumoMedioKwh: 400,
      kwpInstalado: 3.3, investimentoEstimado: 13200, economiaMensalMedia: 352.28, cliente: { id: 7, nome: 'Maria' },
    });
    expect(resposta.body.simulacoes[1].cliente).toBeNull();
  });

  it('aplica os filtros e limita porPagina=1000 a 100', async () => {
    await request(criarApp()).get('/api/admin/simulacoes?de=2026-11-01&ate=2026-11-30&cidade=%20Mococa%20&comPedido=false&porPagina=1000').set('Cookie', OPERADOR);

    expect(listarSimulacoes).toHaveBeenCalledWith({ de: '2026-11-01', ate: '2026-11-30', cidade: 'Mococa', comPedido: false, pagina: 1, porPagina: 100 });
  });

  it.each(['de=ontem', 'ate=2026-13-40', 'comPedido=talvez', 'pagina=0', 'ordem=cidade'])('?%s → 400', async (query) => {
    const resposta = await request(criarApp()).get(`/api/admin/simulacoes?${query}`).set('Cookie', OPERADOR);

    expect(resposta.status).toBe(400);
    expect(listarSimulacoes).not.toHaveBeenCalled();
  });
});
