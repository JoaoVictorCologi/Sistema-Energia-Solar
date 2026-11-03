import { Decimal } from 'decimal.js';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { buscarCodigoIbgeDoCep, salvarCepNoCache } from '../repositories/cepRepository.ts';
import { buscarUltimoIndicador } from '../repositories/indicadoresRepository.ts';
import { buscarIrradiacaoDoMunicipio } from '../repositories/irradiacaoRepository.ts';
import { buscarMunicipio } from '../repositories/municipiosRepository.ts';
import { inserirSimulacao } from '../repositories/simulacoesRepository.ts';
import { buscarTarifaVigente } from '../repositories/tarifasRepository.ts';
import { simularEconomia } from '../services/simulacaoService.ts';

vi.mock('../repositories/cepRepository.ts', () => ({ buscarCodigoIbgeDoCep: vi.fn(), salvarCepNoCache: vi.fn() }));
vi.mock('../repositories/municipiosRepository.ts', () => ({ buscarMunicipio: vi.fn() }));
vi.mock('../repositories/tarifasRepository.ts', () => ({ buscarTarifaVigente: vi.fn() }));
vi.mock('../repositories/irradiacaoRepository.ts', () => ({ buscarIrradiacaoDoMunicipio: vi.fn() }));
vi.mock('../repositories/indicadoresRepository.ts', () => ({ buscarUltimoIndicador: vi.fn() }));
vi.mock('../repositories/simulacoesRepository.ts', () => ({ inserirSimulacao: vi.fn() }));

// Dados reais: Mococa-SP no Atlas, tarifa B1 da CPFL Santa Cruz (22/04/2026), IPCA 12 meses e Selic de 11/2026.
const MOCOCA = { codigoIbge: 3530508, nome: 'Mococa', uf: 'SP' };
const HSP_MOCOCA = ['5.099', '5.569', '5.31', '5.47', '5', '4.881', '5.072', '5.76', '5.326', '5.407', '5.252', '5.251'];
const TARIFA_B1 = {
  id: 41, subgrupo: 'B1', modalidade: 'Convencional', classe: 'Residencial', subclasse: 'Residencial',
  te: new Decimal('0.25219'), tusd: new Decimal('0.56039'), fioB: new Decimal('0.272853'), inicioVigencia: '2026-04-22', fimVigencia: '2027-04-21',
};
const PEDIDO = { cep: '13730-250', tipoLigacao: 'monofasico', consumoMedioKwh: 400 };

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

// Qualquer chamada externa falha: prova que a simulação com CEP em cache só lê o banco (ANEEL "desligada").
const internetDesligada = vi.fn(async () => { throw new TypeError('fetch failed'); });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', internetDesligada);
  vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(MOCOCA.codigoIbge);
  vi.mocked(buscarMunicipio).mockImplementation(async (codigo) => (codigo === MOCOCA.codigoIbge ? MOCOCA : undefined));
  vi.mocked(buscarTarifaVigente).mockResolvedValue(TARIFA_B1);
  vi.mocked(buscarIrradiacaoDoMunicipio).mockResolvedValue({ id: 7, hspAnual: new Decimal('5.283'), hspMensal: HSP_MOCOCA.map((hsp) => new Decimal(hsp)) });
  vi.mocked(buscarUltimoIndicador).mockImplementation(async (serie) => ({ data: '2026-09-01', valor: new Decimal(serie === 432 ? '13.75' : '4.58') }));
  vi.mocked(inserirSimulacao).mockResolvedValue('a1f811c5-cd03-45d1-b9aa-f107b9eefb47');
});
afterEach(() => vi.unstubAllGlobals());

describe('GET /api/cep/:cep', () => {
  it('CEP com formato inválido → 400', async () => {
    const resposta = await request(criarApp()).get('/api/cep/1373-25');

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.fields).toEqual({ cep: 'Informe o CEP com 8 números.' });
  });

  it('CEP em cache responde sem consultar o ViaCEP', async () => {
    const resposta = await request(criarApp()).get('/api/cep/13730-250');

    expect(resposta.body).toEqual({ cep: '13730250', cidade: 'Mococa', uf: 'SP', atendido: true });
    expect(internetDesligada).not.toHaveBeenCalled();
  });

  it('CEP novo da região atendida consulta o ViaCEP e entra no cache', async () => {
    vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(undefined);
    const fetch = vi.fn().mockResolvedValue(respostaJson({ cep: '13730-250', localidade: 'Mococa', uf: 'SP', ibge: '3530508' }));
    vi.stubGlobal('fetch', fetch);

    const resposta = await request(criarApp()).get('/api/cep/13730250');

    expect(fetch.mock.calls[0][0]).toBe('https://viacep.com.br/ws/13730250/json/');
    expect(resposta.body.atendido).toBe(true);
    expect(salvarCepNoCache).toHaveBeenCalledWith('13730250', 3530508);
  });

  it('CEP de outra UF não é atendido e não entra no cache', async () => {
    vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({ localidade: 'Rio de Janeiro', uf: 'RJ', ibge: '3304557' })));

    const resposta = await request(criarApp()).get('/api/cep/20040-002');

    expect(resposta.body).toEqual({ cep: '20040002', cidade: 'Rio de Janeiro', uf: 'RJ', atendido: false });
    expect(salvarCepNoCache).not.toHaveBeenCalled();
  });

  it('CEP inexistente → 404', async () => {
    vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({ erro: 'true' })));

    const resposta = await request(criarApp()).get('/api/cep/99999-999');

    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('CEP_NAO_ENCONTRADO');
  });

  it('ViaCEP fora do ar → 503 com mensagem amigável, depois de 2 tentativas', async () => {
    vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(undefined);

    const resposta = await request(criarApp()).get('/api/cep/13730-250');

    expect(resposta.status).toBe(503);
    expect(resposta.body.error).toEqual({ code: 'CEP_INDISPONIVEL', message: 'Não foi possível consultar o CEP agora. Tente de novo em instantes.' });
    expect(internetDesligada).toHaveBeenCalledTimes(2);
  });
});

describe('POST /api/simulacoes', () => {
  it('simula pela tarifa, irradiação e indicadores do banco, sem chamar a ANEEL, e grava a simulação', async () => {
    const resposta = await request(criarApp()).post('/api/simulacoes').send(PEDIDO);

    expect(resposta.status).toBe(201);
    const { simulacao } = resposta.body;
    expect(simulacao.codigo).toBe('a1f811c5-cd03-45d1-b9aa-f107b9eefb47');
    expect(simulacao.dimensionamento).toEqual({ numeroModulos: 6, potenciaModuloW: 550, kwpInstalado: 3.3, inversorKw: 3 });
    expect(simulacao.investimentoEstimado.valor).toBe(13200);
    expect(simulacao.primeiroAno).toHaveLength(12);
    expect(simulacao.resumoAnual).toHaveLength(25);
    expect(simulacao.premissas).toMatchObject({ distribuidora: 'CPFL Santa Cruz', tarifaComImpostos: 1.062196, reajusteAnual: 0.0458, taxaDesconto: 0.1375 });
    expect(simulacao.indicadores.economiaMensalMedia).toBeGreaterThan(300);
    expect(internetDesligada).not.toHaveBeenCalled();
    expect(inserirSimulacao).toHaveBeenCalledWith(expect.objectContaining({
      cep: '13730250', codigo_ibge: 3530508, tarifa_id: 41, irradiacao_id: 7, versao_parametros: expect.any(String),
    }));
  });

  it('busca a tarifa do subgrupo pedido e usa o ICMS da faixa de consumo', async () => {
    const resposta = await request(criarApp()).post('/api/simulacoes').send({ ...PEDIDO, subgrupo: 'B3', consumoMedioKwh: 150 });

    expect(buscarTarifaVigente).toHaveBeenCalledWith(expect.objectContaining({ sigla: 'CPFL Santa Cruz', subgrupo: 'B3', classe: 'Não se aplica', subclasse: 'Não se aplica' }));
    expect(resposta.body.simulacao.premissas.tributos.icms).toBe(0.12);
    expect(resposta.body.simulacao.premissas.simultaneidade).toBe(0.4);
  });

  it.each([
    ['CEP com formato inválido', { ...PEDIDO, cep: '1373' }, 'cep'],
    ['consumo negativo', { ...PEDIDO, consumoMedioKwh: -10 }, 'consumoMedioKwh'],
    ['consumo acima de 20.000 kWh', { ...PEDIDO, consumoMedioKwh: 20_001 }, 'consumoMedioKwh'],
    ['tipo de ligação desconhecido', { ...PEDIDO, tipoLigacao: 'quadrifasico' }, 'tipoLigacao'],
    ['investimento enviado pelo visitante', { ...PEDIDO, investimento: 1 }, 'investimento'],
  ])('%s → 400', async (_caso, corpo, campo) => {
    const resposta = await request(criarApp()).post('/api/simulacoes').send(corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
    expect(inserirSimulacao).not.toHaveBeenCalled();
  });

  it('CEP de outra UF → "região ainda não atendida"', async () => {
    vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({ localidade: 'Rio de Janeiro', uf: 'RJ', ibge: '3304557' })));

    const resposta = await request(criarApp()).post('/api/simulacoes').send({ ...PEDIDO, cep: '20040-002' });

    expect(resposta.status).toBe(422);
    expect(resposta.body.error).toEqual({ code: 'REGIAO_NAO_ATENDIDA', message: 'Região ainda não atendida. Por enquanto, o simulador atende só o estado de SP.' });
  });

  it('ViaCEP fora do ar → 503 com mensagem amigável', async () => {
    vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(undefined);

    const resposta = await request(criarApp()).post('/api/simulacoes').send(PEDIDO);

    expect(resposta.status).toBe(503);
    expect(resposta.body.error.code).toBe('CEP_INDISPONIVEL');
  });

  it('sem tarifa (ou sem Fio B) no banco → 503, sem gravar', async () => {
    vi.mocked(buscarTarifaVigente).mockResolvedValue({ ...TARIFA_B1, fioB: null });

    const resposta = await request(criarApp()).post('/api/simulacoes').send(PEDIDO);

    expect(resposta.status).toBe(503);
    expect(resposta.body.error.code).toBe('SIMULACAO_INDISPONIVEL');
    expect(inserirSimulacao).not.toHaveBeenCalled();
  });

  it('31ª simulação no minuto → 429', async () => {
    const app = criarApp();
    for (let vez = 0; vez < 30; vez++) await request(app).post('/api/simulacoes').send(PEDIDO).expect(201);

    const resposta = await request(app).post('/api/simulacoes').send(PEDIDO);

    expect(resposta.status).toBe(429);
    expect(resposta.body.error.code).toBe('MUITAS_REQUISICOES');
  });

  it('responde em menos de 300 ms', async () => {
    const app = criarApp();
    await request(app).post('/api/simulacoes').send(PEDIDO);
    const inicio = performance.now();

    await request(app).post('/api/simulacoes').send(PEDIDO).expect(201);

    expect(performance.now() - inicio).toBeLessThan(300);
  });
});

describe('simularEconomia', () => {
  it('a conexão prevista é o mês seguinte, em São Paulo', async () => {
    const pedido = { cep: '13730250', tipoLigacao: 'monofasico' as const, subgrupo: 'B1' as const, consumoMedioKwh: new Decimal(400) };

    // 01/01/2027 às 01:00 em UTC ainda é 31/12/2026 em São Paulo.
    const simulacao = await simularEconomia(pedido, new Date('2027-01-01T01:00:00Z'));

    expect(simulacao.premissas.inicio).toEqual({ ano: 2027, mes: 1 });
    expect(simulacao.primeiroAno[0]).toMatchObject({ anoCivil: 2027, mes: 1 });
  });

  it('avisa quando a vigência da tarifa já venceu e a nova não foi importada', async () => {
    const pedido = { cep: '13730250', tipoLigacao: 'monofasico' as const, subgrupo: 'B1' as const, consumoMedioKwh: new Decimal(400) };

    const simulacao = await simularEconomia(pedido, new Date('2027-05-10T12:00:00Z'));

    expect(simulacao.alertas.map((alerta) => alerta.codigo)).toContain('TARIFA_DESATUALIZADA');
  });
});
