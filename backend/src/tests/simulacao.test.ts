import { Decimal } from 'decimal.js';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { buscarCodigoIbgeDoCep, salvarCepNoCache } from '../repositories/cepRepository.ts';
import { buscarConfiguracaoComercial, listarFormasDePagamento } from '../repositories/configuracoesRepository.ts';
import { listarDistribuidorasDaUf, listarDistribuidorasDoMunicipio } from '../repositories/distribuidorasRepository.ts';
import { buscarUltimoIndicador } from '../repositories/indicadoresRepository.ts';
import { buscarIrradiacaoDoMunicipio } from '../repositories/irradiacaoRepository.ts';
import { buscarMunicipio } from '../repositories/municipiosRepository.ts';
import { inserirSimulacao } from '../repositories/simulacoesRepository.ts';
import { buscarTarifaVigente, buscarUltimaTarifaComFioB, listarCnpjsComTarifaDesde } from '../repositories/tarifasRepository.ts';
import { parametros } from '../parametros/parametros.ts';
import { simularEconomia } from '../services/simulacaoService.ts';
import { CONFIGURACAO_INICIAL } from './apoio/comercialDeTeste.ts';

vi.mock('../repositories/cepRepository.ts', () => ({ buscarCodigoIbgeDoCep: vi.fn(), salvarCepNoCache: vi.fn() }));
vi.mock('../repositories/configuracoesRepository.ts', () => ({ buscarConfiguracaoComercial: vi.fn(), listarFormasDePagamento: vi.fn() }));
vi.mock('../repositories/municipiosRepository.ts', () => ({ buscarMunicipio: vi.fn() }));
vi.mock('../repositories/distribuidorasRepository.ts', () => ({ listarDistribuidorasDoMunicipio: vi.fn(), listarDistribuidorasDaUf: vi.fn() }));
vi.mock('../repositories/tarifasRepository.ts', () => ({ buscarTarifaVigente: vi.fn(), buscarUltimaTarifaComFioB: vi.fn(), listarCnpjsComTarifaDesde: vi.fn() }));
vi.mock('../repositories/irradiacaoRepository.ts', () => ({ buscarIrradiacaoDoMunicipio: vi.fn() }));
vi.mock('../repositories/indicadoresRepository.ts', () => ({ buscarUltimoIndicador: vi.fn() }));
vi.mock('../repositories/simulacoesRepository.ts', () => ({ inserirSimulacao: vi.fn() }));

// Dados reais: Mococa-SP no Atlas, tarifa B1 da CPFL Santa Cruz (22/04/2026), IPCA 12 meses e Selic de 11/2026.
const MOCOCA = { codigoIbge: 3530508, nome: 'Mococa', uf: 'SP' };
const SAO_PAULO = { codigoIbge: 3550308, nome: 'São Paulo', uf: 'SP' };
const RIO = { codigoIbge: 3304557, nome: 'Rio de Janeiro', uf: 'RJ' };
const BOA_VIAGEM = { codigoIbge: 2302404, nome: 'Boa Viagem', uf: 'CE' };
const MUNICIPIOS = [MOCOCA, SAO_PAULO, RIO, BOA_VIAGEM];
const SANTA_CRUZ = { id: 1, cnpj: '53859112000169', sigla: 'CPFL Santa Cruz', conjuntos: 1, sugerida: true };
const ELETROPAULO = { id: 48, cnpj: '61695227000193', sigla: 'ELETROPAULO', conjuntos: 111, sugerida: true };
const CERIS = { id: 50, cnpj: '57384943000182', sigla: 'CERIS', conjuntos: 1, sugerida: false };
const LIGHT = { id: 60, cnpj: '60444437000146', sigla: 'LIGHT SESA', conjuntos: 30, sugerida: true };
const ENEL_CE = { id: 70, cnpj: '07047251000170', sigla: 'ENEL CE' };
const VINCULOS: Record<number, (typeof SANTA_CRUZ)[]> = { 3530508: [SANTA_CRUZ], 3550308: [ELETROPAULO, CERIS], 3304557: [LIGHT], 2302404: [] };
const HSP_MOCOCA = ['5.099', '5.569', '5.31', '5.47', '5', '4.881', '5.072', '5.76', '5.326', '5.407', '5.252', '5.251'];
const TARIFA_B1 = {
  id: 41, subgrupo: 'B1', modalidade: 'Convencional', classe: 'Residencial', subclasse: 'Residencial',
  te: new Decimal('0.25219'), tusd: new Decimal('0.56039'), fioB: new Decimal('0.272853'), inicioVigencia: '2026-04-22', fimVigencia: '2027-04-21',
};
const PEDIDO = { cep: '13730-250', tipoLigacao: 'monofasico', consumoMedioKwh: 400 };
const CEP_DO_MUNICIPIO: Record<string, number> = { '13730250': 3530508, '01310100': 3550308, '20040002': 3304557, '63874128': 2302404 };

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

// Qualquer chamada externa falha: prova que a simulação com CEP em cache só lê o banco (ANEEL "desligada").
const internetDesligada = vi.fn(async () => { throw new TypeError('fetch failed'); });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', internetDesligada);
  vi.mocked(buscarCodigoIbgeDoCep).mockImplementation(async (cep) => CEP_DO_MUNICIPIO[cep]);
  vi.mocked(buscarMunicipio).mockImplementation(async (codigo) => MUNICIPIOS.find((municipio) => municipio.codigoIbge === codigo));
  vi.mocked(listarDistribuidorasDoMunicipio).mockImplementation(async (codigo) => VINCULOS[codigo] ?? []);
  vi.mocked(listarDistribuidorasDaUf).mockResolvedValue([ENEL_CE]);
  vi.mocked(listarCnpjsComTarifaDesde).mockResolvedValue(new Set([SANTA_CRUZ, ELETROPAULO, CERIS, LIGHT, ENEL_CE].map((item) => item.cnpj)));
  vi.mocked(buscarTarifaVigente).mockResolvedValue(TARIFA_B1);
  vi.mocked(buscarIrradiacaoDoMunicipio).mockResolvedValue({ id: 7, hspAnual: new Decimal('5.283'), hspMensal: HSP_MOCOCA.map((hsp) => new Decimal(hsp)) });
  vi.mocked(buscarUltimoIndicador).mockImplementation(async (serie) => ({ data: '2026-09-01', valor: new Decimal(serie === 432 ? '13.75' : '4.58') }));
  vi.mocked(inserirSimulacao).mockResolvedValue('a1f811c5-cd03-45d1-b9aa-f107b9eefb47');
  vi.mocked(buscarConfiguracaoComercial).mockResolvedValue(CONFIGURACAO_INICIAL);
  vi.mocked(listarFormasDePagamento).mockResolvedValue([]);
});
afterEach(() => vi.unstubAllGlobals());

const simular = (corpo: object) => request(criarApp()).post('/api/simulacoes').send(corpo);
const codigosDosAlertas = (resposta: { body: { simulacao: { alertas: { codigo: string }[] } } }) => resposta.body.simulacao.alertas.map((alerta) => alerta.codigo);

describe('GET /api/cep/:cep', () => {
  it('CEP com formato inválido → 400', async () => {
    const resposta = await request(criarApp()).get('/api/cep/1373-25');

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.fields).toEqual({ cep: 'Informe o CEP com 8 números.' });
  });

  it('CEP em cache responde sem consultar o ViaCEP; com uma distribuidora, a escolha é automática', async () => {
    const resposta = await request(criarApp()).get('/api/cep/13730-250');

    expect(resposta.body).toEqual({
      cep: '13730250', cidade: 'Mococa', uf: 'SP', atendido: true,
      distribuidoras: [{ cnpj: SANTA_CRUZ.cnpj, sigla: 'CPFL Santa Cruz', sugerida: false }], escolhaNecessaria: false,
    });
    expect(internetDesligada).not.toHaveBeenCalled();
  });

  it('município com mais de uma distribuidora pede a escolha e marca a sugerida', async () => {
    const resposta = await request(criarApp()).get('/api/cep/01310-100');

    expect(resposta.body.escolhaNecessaria).toBe(true);
    expect(resposta.body.distribuidoras).toEqual([
      { cnpj: ELETROPAULO.cnpj, sigla: 'ELETROPAULO', sugerida: true },
      { cnpj: CERIS.cnpj, sigla: 'CERIS', sugerida: false },
    ]);
  });

  it('município sem vínculo na ANEEL oferece as distribuidoras da UF', async () => {
    const resposta = await request(criarApp()).get('/api/cep/63874-128');

    expect(listarDistribuidorasDaUf).toHaveBeenCalledWith('CE');
    expect(resposta.body).toMatchObject({ atendido: true, distribuidoras: [{ cnpj: ENEL_CE.cnpj, sigla: 'ENEL CE', sugerida: false }] });
  });

  it('distribuidora sem tarifa recente não aparece na escolha', async () => {
    vi.mocked(listarCnpjsComTarifaDesde).mockResolvedValue(new Set([ELETROPAULO.cnpj]));

    const resposta = await request(criarApp()).get('/api/cep/01310-100');

    expect(resposta.body).toMatchObject({ escolhaNecessaria: false, distribuidoras: [{ cnpj: ELETROPAULO.cnpj, sugerida: false }] });
  });

  it('CEP novo de qualquer UF consulta o ViaCEP e entra no cache', async () => {
    vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(undefined);
    const fetch = vi.fn().mockResolvedValue(respostaJson({ localidade: 'Rio de Janeiro', uf: 'RJ', ibge: '3304557' }));
    vi.stubGlobal('fetch', fetch);

    const resposta = await request(criarApp()).get('/api/cep/20040-002');

    expect(fetch.mock.calls[0][0]).toBe('https://viacep.com.br/ws/20040002/json/');
    expect(resposta.body).toMatchObject({ cidade: 'Rio de Janeiro', uf: 'RJ', atendido: true });
    expect(salvarCepNoCache).toHaveBeenCalledWith('20040002', 3304557);
  });

  it('município que não está no banco não é atendido e não entra no cache', async () => {
    vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({ localidade: 'Município Novo', uf: 'MT', ibge: '5199999' })));

    const resposta = await request(criarApp()).get('/api/cep/78000-000');

    expect(resposta.body).toMatchObject({ cidade: 'Município Novo', atendido: false, distribuidoras: [] });
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
    const resposta = await simular(PEDIDO);

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
    const { entrada } = vi.mocked(inserirSimulacao).mock.calls[0][0] as { entrada: { pedido: { distribuidora: unknown } } };
    expect(entrada.pedido.distribuidora).toEqual({ cnpj: SANTA_CRUZ.cnpj, sigla: 'CPFL Santa Cruz' });
  });

  describe('aviso de calibração de PR e simultaneidade', () => {
    afterEach(() => { parametros.calibracao.calibrada = false; });

    it('sem contas reais conferidas, avisa em todas as distribuidoras, inclusive na de Mococa', async () => {
      for (const cep of ['13730-250', '20040-002']) {
        const alertas = codigosDosAlertas(await simular({ ...PEDIDO, cep }));
        expect(alertas).toContain('PREMISSAS_NAO_CALIBRADAS');
        expect(alertas).not.toContain('ESTIMATIVA_FORA_DA_REGIAO_CALIBRADA');
      }
    });

    it('depois da calibração, avisa só fora da distribuidora das contas', async () => {
      parametros.calibracao.calibrada = true;

      const mococa = codigosDosAlertas(await simular(PEDIDO));
      const rio = await simular({ ...PEDIDO, cep: '20040-002' });

      expect(mococa).not.toContain('PREMISSAS_NAO_CALIBRADAS');
      expect(mococa).not.toContain('ESTIMATIVA_FORA_DA_REGIAO_CALIBRADA');
      expect(rio.body.simulacao.alertas).toContainEqual({
        codigo: 'ESTIMATIVA_FORA_DA_REGIAO_CALIBRADA',
        mensagem: 'Aproveitamento do sistema e consumo simultâneo foram calibrados com contas da CPFL Santa Cruz: para LIGHT SESA, são valores típicos e o resultado é uma estimativa.',
      });
    });
  });

  it('busca a tarifa pelo CNPJ e pelo subgrupo pedido, e usa o ICMS da faixa de consumo', async () => {
    const resposta = await simular({ ...PEDIDO, subgrupo: 'B3', consumoMedioKwh: 150 });

    expect(buscarTarifaVigente).toHaveBeenCalledWith(expect.objectContaining({ cnpj: SANTA_CRUZ.cnpj, subgrupo: 'B3', classe: 'Não se aplica', subclasse: 'Não se aplica' }));
    expect(resposta.body.simulacao.premissas.tributos.icms).toBe(0.12);
    expect(resposta.body.simulacao.premissas.simultaneidade).toBe(0.4);
  });

  it('usa o ICMS da UF do município (RJ: 22% acima de 300 kWh)', async () => {
    const resposta = await simular({ ...PEDIDO, cep: '20040-002' });

    expect(resposta.status).toBe(201);
    expect(resposta.body.simulacao.premissas).toMatchObject({ distribuidora: 'LIGHT SESA', tributos: { icms: 0.22 } });
  });

  it('com mais de uma distribuidora, sem escolha → 400 DISTRIBUIDORA_OBRIGATORIA', async () => {
    const resposta = await simular({ ...PEDIDO, cep: '01310-100' });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('DISTRIBUIDORA_OBRIGATORIA');
    expect(resposta.body.error.fields).toEqual({ distribuidora: 'Escolha uma das distribuidoras do município.' });
    expect(inserirSimulacao).not.toHaveBeenCalled();
  });

  it('com a escolha do cliente, usa a tarifa dessa distribuidora', async () => {
    const resposta = await simular({ ...PEDIDO, cep: '01310-100', distribuidora: CERIS.cnpj });

    expect(resposta.status).toBe(201);
    expect(buscarTarifaVigente).toHaveBeenCalledWith(expect.objectContaining({ cnpj: CERIS.cnpj }));
    expect(resposta.body.simulacao.premissas.distribuidora).toBe('CERIS');
  });

  it('distribuidora que não atende o município → 400 DISTRIBUIDORA_INVALIDA', async () => {
    const resposta = await simular({ ...PEDIDO, distribuidora: ELETROPAULO.cnpj });

    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('DISTRIBUIDORA_INVALIDA');
  });

  it('sem Fio B publicado na vigência atual, usa o último, corrigido pela variação da TUSD, e avisa', async () => {
    vi.mocked(buscarTarifaVigente).mockResolvedValue({ ...TARIFA_B1, fioB: null });
    vi.mocked(buscarUltimaTarifaComFioB).mockResolvedValue({ ...TARIFA_B1, id: 30, tusd: new Decimal('0.5'), fioB: new Decimal('0.2'), inicioVigencia: '2023-11-22', fimVigencia: '2024-11-21' });

    const resposta = await simular(PEDIDO);

    // 0,20 × 0,56039 ÷ 0,50 = 0,224156.
    expect(resposta.body.simulacao.premissas.tarifaSemImpostos.fioB).toBe(0.224156);
    expect(resposta.body.simulacao.alertas).toContainEqual(expect.objectContaining({ codigo: 'FIO_B_DA_VIGENCIA_ANTERIOR', mensagem: expect.stringContaining('2023-11-22') }));
  });

  it.each([
    ['CEP com formato inválido', { ...PEDIDO, cep: '1373' }, 'cep'],
    ['consumo negativo', { ...PEDIDO, consumoMedioKwh: -10 }, 'consumoMedioKwh'],
    ['consumo acima de 20.000 kWh', { ...PEDIDO, consumoMedioKwh: 20_001 }, 'consumoMedioKwh'],
    ['tipo de ligação desconhecido', { ...PEDIDO, tipoLigacao: 'quadrifasico' }, 'tipoLigacao'],
    ['distribuidora que não é CNPJ', { ...PEDIDO, distribuidora: 'CPFL' }, 'distribuidora'],
    ['investimento enviado pelo visitante', { ...PEDIDO, investimento: 1 }, 'investimento'],
  ])('%s → 400', async (_caso, corpo, campo) => {
    const resposta = await simular(corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
    expect(inserirSimulacao).not.toHaveBeenCalled();
  });

  it('município sem nenhuma distribuidora com tarifa → "região ainda não atendida"', async () => {
    vi.mocked(listarCnpjsComTarifaDesde).mockResolvedValue(new Set());

    const resposta = await simular(PEDIDO);

    expect(resposta.status).toBe(422);
    expect(resposta.body.error.code).toBe('REGIAO_NAO_ATENDIDA');
  });

  it('ViaCEP fora do ar → 503 com mensagem amigável', async () => {
    vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(undefined);

    const resposta = await simular(PEDIDO);

    expect(resposta.status).toBe(503);
    expect(resposta.body.error.code).toBe('CEP_INDISPONIVEL');
  });

  it('sem tarifa, ou sem Fio B em nenhuma vigência, no banco → 503, sem gravar', async () => {
    vi.mocked(buscarTarifaVigente).mockResolvedValue({ ...TARIFA_B1, fioB: null });
    vi.mocked(buscarUltimaTarifaComFioB).mockResolvedValue(undefined);

    const resposta = await simular(PEDIDO);

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
  const pedido = { cep: '13730250', tipoLigacao: 'monofasico' as const, subgrupo: 'B1' as const, consumoMedioKwh: new Decimal(400) };

  it('a conexão prevista é o mês seguinte, em São Paulo', async () => {
    // 01/01/2027 às 01:00 em UTC ainda é 31/12/2026 em São Paulo.
    const simulacao = await simularEconomia(pedido, new Date('2027-01-01T01:00:00Z'));

    expect(simulacao.premissas.inicio).toEqual({ ano: 2027, mes: 1 });
    expect(simulacao.primeiroAno[0]).toMatchObject({ anoCivil: 2027, mes: 1 });
  });

  it('avisa quando a vigência da tarifa já venceu e a nova não foi importada', async () => {
    const simulacao = await simularEconomia(pedido, new Date('2027-05-10T12:00:00Z'));

    expect(simulacao.alertas.map((alerta) => alerta.codigo)).toContain('TARIFA_DESATUALIZADA');
  });
});
