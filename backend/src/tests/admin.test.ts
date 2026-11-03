import { Decimal } from 'decimal.js';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { buscarClientePorId, listarClientes } from '../repositories/clientesRepository.ts';
import { listarUltimasImportacoes } from '../repositories/importacoesRepository.ts';
import { contarTotais } from '../repositories/painelRepository.ts';
import { contarPropostasPorStatus, listarPropostas } from '../repositories/propostasRepository.ts';
import { listarSimulacoesDoCliente } from '../repositories/simulacoesRepository.ts';
import { gerarToken } from '../services/authService.ts';

vi.mock('../repositories/clientesRepository.ts', () => ({ buscarClientePorId: vi.fn(), listarClientes: vi.fn() }));
vi.mock('../repositories/importacoesRepository.ts', () => ({ listarUltimasImportacoes: vi.fn() }));
vi.mock('../repositories/painelRepository.ts', () => ({ contarTotais: vi.fn() }));
vi.mock('../repositories/propostasRepository.ts', () => ({ contarPropostasPorStatus: vi.fn(), listarPropostas: vi.fn() }));
vi.mock('../repositories/simulacoesRepository.ts', () => ({ listarSimulacoesDoCliente: vi.fn() }));

const ADMIN = `sessao=${gerarToken({ id: 1, papel: 'admin' })}`;
const USUARIO = `sessao=${gerarToken({ id: 2, papel: 'usuario' })}`;
const CRIADO_EM = new Date('2026-11-03T12:00:00Z');
const MARIA = { id: 7, nome: 'Maria', email: 'maria@exemplo.com', telefone: '19999990000', cep: '13730250', aceite_em: CRIADO_EM, criado_em: CRIADO_EM };
const RESULTADO_GRAVADO = {
  local: { cidade: 'Mococa', uf: 'SP' },
  pedido: { tipoLigacao: 'monofasico', subgrupo: 'B1', consumoMedioKwh: 400 },
  dimensionamento: { numeroModulos: 6, potenciaModuloW: 550, kwpInstalado: 3.3, inversorKw: 3 },
  investimentoEstimado: { valor: 13200, aviso: '…' },
  indicadores: { economiaMensalMedia: 352.28 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarClientes).mockResolvedValue({ clientes: [MARIA], total: 1 });
  vi.mocked(buscarClientePorId).mockImplementation(async (id) => (id === 7 ? MARIA : undefined));
  vi.mocked(listarSimulacoesDoCliente).mockResolvedValue([{ id: 3, codigo: 'a1f8', criado_em: CRIADO_EM, resultado: RESULTADO_GRAVADO }]);
  vi.mocked(contarTotais).mockResolvedValue({ clientes: 4, simulacoes: 10, simulacoesComPedido: 4 });
  vi.mocked(listarUltimasImportacoes).mockResolvedValue([]);
  vi.mocked(contarPropostasPorStatus).mockResolvedValue({ enviada: 2, aceita: 1, recusada: 0 });
  vi.mocked(listarPropostas).mockResolvedValue({
    propostas: [{ id: 5, clienteId: 7, clienteNome: 'Maria', status: 'enviada', investimento: new Decimal('12012'), validaAte: '2026-11-13', criadoEm: CRIADO_EM }],
    total: 1,
  });
});

describe('acesso à área restrita', () => {
  it.each(['/api/admin/painel', '/api/admin/clientes', '/api/admin/clientes/7'])('%s: sem login → 401, sem papel admin → 403', async (rota) => {
    expect((await request(criarApp()).get(rota)).status).toBe(401);
    expect((await request(criarApp()).get(rota).set('Cookie', USUARIO)).status).toBe(403);
  });
});

describe('GET /api/admin/painel', () => {
  it('traz as contagens e a última importação de tarifas', async () => {
    vi.mocked(listarUltimasImportacoes).mockResolvedValue([{
      id: 1, tipo: 'aneel-tarifas', status: 'sem_alteracao', iniciada_em: CRIADO_EM, finalizada_em: CRIADO_EM, versao_da_fonte: 'v', linhas_gravadas: 0, mensagem: null,
    }]);

    const resposta = await request(criarApp()).get('/api/admin/painel').set('Cookie', ADMIN);

    expect(resposta.body.painel).toEqual({
      clientes: 4, simulacoes: 10, simulacoesComPedido: 4, propostasPorStatus: { enviada: 2, aceita: 1, recusada: 0 },
      ultimaImportacaoDeTarifas: { status: 'sem_alteracao', finalizadaEm: CRIADO_EM.toISOString() },
    });
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
  it('traz contato e o resumo das simulações do cliente', async () => {
    const resposta = await request(criarApp()).get('/api/admin/clientes/7').set('Cookie', ADMIN);

    expect(resposta.body.cliente).toEqual({
      id: 7, nome: 'Maria', email: 'maria@exemplo.com', telefone: '19999990000', cep: '13730250',
      criadoEm: CRIADO_EM.toISOString(), aceiteEm: CRIADO_EM.toISOString(),
    });
    expect(resposta.body.simulacoes).toEqual([{
      codigo: 'a1f8', criadaEm: CRIADO_EM.toISOString(), cidade: 'Mococa', tipoLigacao: 'monofasico',
      consumoMedioKwh: 400, kwpInstalado: 3.3, investimentoEstimado: 13200, economiaMensalMedia: 352.28,
    }]);
    expect(listarPropostas).toHaveBeenCalledWith({ clienteId: 7, pagina: 1, porPagina: 100 });
    expect(resposta.body.propostas).toEqual([{ id: 5, status: 'enviada', investimento: 12012, validaAte: '2026-11-13', vencida: expect.any(Boolean), criadoEm: CRIADO_EM.toISOString() }]);
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
