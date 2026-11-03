import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { ErroDeIntegracao } from '../integracoes/http.ts';
import type { JobDeImportacao } from '../jobs/tipos.ts';
import {
  existeImportacaoEmAndamento, finalizarImportacao, iniciarImportacao, listarUltimasImportacoes, type ImportacaoResumo,
} from '../repositories/importacoesRepository.ts';
import { listarSituacaoDasImportacoes } from '../services/importacoesService.ts';
import { gerarToken } from '../services/authService.ts';

vi.mock('../repositories/importacoesRepository.ts', () => ({
  existeImportacaoEmAndamento: vi.fn(),
  iniciarImportacao: vi.fn(),
  finalizarImportacao: vi.fn(),
  listarUltimasImportacoes: vi.fn(),
  buscarVersaoDaUltimaImportacao: vi.fn(),
}));

const executarJobDoModulo = vi.fn<JobDeImportacao['executar']>();

vi.mock('../modulos/index.ts', () => ({
  routersDosModulos: [],
  jobsDosModulos: [{ tipo: 'modulo-teste', descricao: 'Job de um módulo', agenda: '0 7 * * *', executar: (contexto: never) => executarJobDoModulo(contexto) }],
}));

const COOKIE_ADMIN = `sessao=${gerarToken({ id: 1, papel: 'admin' })}`;
const INICIO = new Date('2026-11-03T09:00:00Z');

function importacao(dados: Partial<ImportacaoResumo>): ImportacaoResumo {
  return {
    id: 10, tipo: 'modulo-teste', status: 'sucesso', iniciada_em: INICIO, finalizada_em: INICIO,
    versao_da_fonte: 'v1', linhas_gravadas: 0, mensagem: null, ...dados,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(existeImportacaoEmAndamento).mockResolvedValue(false);
  vi.mocked(iniciarImportacao).mockResolvedValue(10);
  vi.mocked(finalizarImportacao).mockImplementation(async (id, fim) => importacao({
    id, status: fim.status, linhas_gravadas: fim.linhasGravadas, versao_da_fonte: fim.versaoDaFonte, mensagem: fim.mensagem,
  }));
  vi.mocked(listarUltimasImportacoes).mockResolvedValue([]);
});

describe('acesso às rotas de importação', () => {
  it.each([
    ['GET', '/api/admin/importacoes'],
    ['POST', '/api/admin/importacoes/aneel-tarifas'],
  ])('%s %s sem login → 401, sem papel admin → 403', async (metodo, rota) => {
    const chamar = () => (metodo === 'GET' ? request(criarApp()).get(rota) : request(criarApp()).post(rota));

    expect((await chamar()).status).toBe(401);
    const comoUsuario = await chamar().set('Cookie', `sessao=${gerarToken({ id: 2, papel: 'usuario' })}`);
    expect(comoUsuario.status).toBe(403);
    expect(iniciarImportacao).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/importacoes', () => {
  it('lista as importações do núcleo e as registradas pelos módulos, com a última execução', async () => {
    vi.mocked(listarUltimasImportacoes).mockImplementation(async (status) => (status
      ? [importacao({ tipo: 'aneel-tarifas', status: 'sem_alteracao' })]
      : [importacao({ tipo: 'aneel-tarifas', status: 'erro', mensagem: 'dadosabertos.aneel.gov.br não respondeu' })]));

    const resposta = await request(criarApp()).get('/api/admin/importacoes').set('Cookie', COOKIE_ADMIN);

    expect(resposta.status).toBe(200);
    expect(resposta.body.importacoes.map((item: { tipo: string }) => item.tipo)).toEqual(['aneel-tarifas', 'bcb-indicadores', 'modulo-teste']);
    expect(resposta.body.importacoes[0]).toEqual({
      tipo: 'aneel-tarifas',
      descricao: 'Tarifas (TE, TUSD) e Fio B da ANEEL',
      agenda: '0 6 * * *',
      ultimaExecucao: {
        id: 10, status: 'erro', iniciadaEm: INICIO.toISOString(), finalizadaEm: INICIO.toISOString(),
        linhasGravadas: 0, mensagem: 'dadosabertos.aneel.gov.br não respondeu',
      },
      ultimoSucessoEm: INICIO.toISOString(),
      desatualizada: expect.any(Boolean),
    });
    expect(resposta.body.importacoes[2]).toMatchObject({ tipo: 'modulo-teste', ultimaExecucao: null, ultimoSucessoEm: null, desatualizada: true });
  });
});

describe('POST /api/admin/importacoes/:tipo', () => {
  it('roda o job na hora e registra o início e o resultado', async () => {
    executarJobDoModulo.mockResolvedValue({ status: 'sucesso', linhasGravadas: 4, versaoDaFonte: 'v2' });

    const resposta = await request(criarApp()).post('/api/admin/importacoes/modulo-teste').set('Cookie', COOKIE_ADMIN);

    expect(resposta.status).toBe(200);
    expect(resposta.body.importacao).toMatchObject({ tipo: 'modulo-teste', status: 'sucesso', linhasGravadas: 4 });
    expect(iniciarImportacao).toHaveBeenCalledWith('modulo-teste', expect.any(Date));
    expect(executarJobDoModulo).toHaveBeenCalledWith({ importacaoId: 10, agora: expect.any(Date) });
    expect(finalizarImportacao).toHaveBeenCalledWith(10, { status: 'sucesso', linhasGravadas: 4, versaoDaFonte: 'v2', mensagem: null }, expect.any(Date));
  });

  it('falha da fonte fica registrada com a mensagem, sem derrubar a requisição', async () => {
    executarJobDoModulo.mockRejectedValue(new ErroDeIntegracao('dadosabertos.aneel.gov.br não respondeu como esperado (tempo esgotado).'));

    const resposta = await request(criarApp()).post('/api/admin/importacoes/modulo-teste').set('Cookie', COOKIE_ADMIN);

    expect(resposta.status).toBe(200);
    expect(resposta.body.importacao).toMatchObject({ status: 'erro', mensagem: 'dadosabertos.aneel.gov.br não respondeu como esperado (tempo esgotado).' });
  });

  it('erro inesperado não expõe detalhes internos', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    executarJobDoModulo.mockRejectedValue(new Error('senha do banco: segredo'));

    const resposta = await request(criarApp()).post('/api/admin/importacoes/modulo-teste').set('Cookie', COOKIE_ADMIN);

    expect(resposta.body.importacao.mensagem).toBe('Erro inesperado na importação; detalhes no log do servidor.');
    expect(JSON.stringify(resposta.body)).not.toContain('segredo');
  });

  it('não roda duas vezes ao mesmo tempo → 409', async () => {
    vi.mocked(existeImportacaoEmAndamento).mockResolvedValue(true);

    const resposta = await request(criarApp()).post('/api/admin/importacoes/modulo-teste').set('Cookie', COOKIE_ADMIN);

    expect(resposta.status).toBe(409);
    expect(resposta.body.error.code).toBe('IMPORTACAO_EM_ANDAMENTO');
    expect(executarJobDoModulo).not.toHaveBeenCalled();
  });

  it.each(['nao-existe', 'ANEEL', 'a%20b'])('tipo desconhecido (%s) → 404', async (tipo) => {
    const resposta = await request(criarApp()).post(`/api/admin/importacoes/${tipo}`).set('Cookie', COOKIE_ADMIN);

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('IMPORTACAO_DESCONHECIDA');
    expect(iniciarImportacao).not.toHaveBeenCalled();
  });
});

describe('aviso de importação desatualizada', () => {
  const DIA_MS = 24 * 60 * 60_000;

  it('avisa quando o último sucesso tem mais de 2 dias, ou quando nunca houve sucesso', async () => {
    vi.mocked(listarUltimasImportacoes).mockResolvedValue([importacao({ tipo: 'aneel-tarifas', status: 'sucesso' })]);

    const umDiaDepois = await listarSituacaoDasImportacoes(new Date(INICIO.getTime() + DIA_MS));
    const tresDiasDepois = await listarSituacaoDasImportacoes(new Date(INICIO.getTime() + 3 * DIA_MS));

    expect(umDiaDepois.find((item) => item.tipo === 'aneel-tarifas')?.desatualizada).toBe(false);
    expect(tresDiasDepois.find((item) => item.tipo === 'aneel-tarifas')?.desatualizada).toBe(true);
    expect(umDiaDepois.find((item) => item.tipo === 'bcb-indicadores')?.desatualizada).toBe(true);
  });
});
