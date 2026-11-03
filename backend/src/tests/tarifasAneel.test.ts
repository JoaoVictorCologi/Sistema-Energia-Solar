import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Decimal } from 'decimal.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FioBDaAneel, TarifaDaAneel } from '../integracoes/aneel.ts';
import { ErroDeIntegracao } from '../integracoes/http.ts';
import { ErroDeImportacao } from '../jobs/tipos.ts';
import { listarCnpjsLigados } from '../repositories/distribuidorasRepository.ts';
import { buscarVersaoDaUltimaImportacao } from '../repositories/importacoesRepository.ts';
import { gravarTarifas, listarTarifasPorCnpj, type DadosDaTarifa, type TarifaGravada } from '../repositories/tarifasRepository.ts';
import {
  converterValorDaAneel, importarTarifasDaAneel, montarTarifas, separarNovasEAlteradas, separarTarifasValidas,
} from '../services/tarifasAneelService.ts';

vi.mock('../repositories/importacoesRepository.ts', () => ({ buscarVersaoDaUltimaImportacao: vi.fn() }));
vi.mock('../repositories/tarifasRepository.ts', () => ({ listarTarifasPorCnpj: vi.fn(), gravarTarifas: vi.fn() }));
vi.mock('../repositories/distribuidorasRepository.ts', () => ({ listarCnpjsLigados: vi.fn() }));

const SANTA_CRUZ = '53859112000169';

const PASTA_DAS_FIXTURES = path.join(import.meta.dirname, 'fixtures', 'aneel');

function lerFixture<T = unknown>(nome: string): T {
  return JSON.parse(readFileSync(path.join(PASTA_DAS_FIXTURES, nome), 'utf8'));
}

const TARIFAS = lerFixture<{ result: { records: TarifaDaAneel[] } }>('datastore_search-tarifas.json').result.records;
const FIO_B = lerFixture<{ result: { records: FioBDaAneel[] } }>('datastore_search-fio-b.json').result.records;
const CONTEXTO = { importacaoId: 7, agora: new Date('2026-11-03T12:00:00Z') };

function tarifa(dados: Partial<DadosDaTarifa> = {}): DadosDaTarifa {
  return {
    subgrupo: 'B1', modalidade: 'Convencional', classe: 'Residencial', subclasse: 'Residencial',
    te: new Decimal('0.25219'), tusd: new Decimal('0.56039'), fioB: new Decimal('0.272853'),
    inicioVigencia: '2026-04-22', fimVigencia: '2027-04-21', ...dados,
  };
}

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

// Responde como a ANEEL a partir das fixtures; `falharNoFioB` simula erro no meio da importação.
// A fixture de tarifas é só da CPFL Santa Cruz; `outraDistribuidora` acrescenta linhas de outro CNPJ.
function simularAneel({ falharNoFioB = false, outraDistribuidora = [] as TarifaDaAneel[] } = {}) {
  return vi.fn(async (url: string, opcoes?: RequestInit) => {
    if (url.endsWith('package_show?id=tarifas-distribuidoras-energia-eletrica')) return respostaJson(lerFixture('package_show-tarifas.json'));
    if (url.endsWith('package_show?id=componentes-tarifarias')) return respostaJson(lerFixture('package_show-componentes.json'));
    const corpo = JSON.parse(opcoes?.body as string);
    if (corpo.filters.DscComponenteTarifario === 'TUSD_FioB') {
      return falharNoFioB ? respostaJson({}, 400) : respostaJson(lerFixture('datastore_search-fio-b.json'));
    }
    return respostaJson({ success: true, result: { records: [...TARIFAS, ...outraDistribuidora] } });
  });
}

const consultasEnviadas = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls
  .filter(([url]) => String(url).endsWith('datastore_search'))
  .map(([, opcoes]) => JSON.parse((opcoes as RequestInit).body as string));

describe('conversão dos valores da ANEEL', () => {
  it('troca a vírgula por ponto e converte R$/MWh em R$/kWh', () => {
    expect(converterValorDaAneel('560,39').toString()).toBe('0.56039');
    expect(converterValorDaAneel(',00').toString()).toBe('0');
    expect(converterValorDaAneel('1250').toString()).toBe('1.25');
  });

  it('guarda 6 casas decimais, como a coluna do banco', () => {
    expect(converterValorDaAneel('272,85321113800001').toString()).toBe('0.272853');
  });

  it('recusa texto que não é número no formato da ANEEL', () => {
    for (const valor of ['', ',', '12.5', '1,2,3', 'abc', '-3,00']) {
      expect(() => converterValorDaAneel(valor)).toThrow(ErroDeImportacao);
    }
  });
});

describe('montagem das tarifas', () => {
  it('junta TE, TUSD e o Fio B da mesma vigência', () => {
    const { tarifas } = montarTarifas(TARIFAS, FIO_B);
    const vigente = tarifas.find((item) => item.subgrupo === 'B1' && item.inicioVigencia === '2026-04-22');
    const anterior = tarifas.find((item) => item.subgrupo === 'B1' && item.inicioVigencia === '2025-05-22');

    expect(tarifas).toHaveLength(6);
    expect(vigente).toMatchObject({ classe: 'Residencial', subclasse: 'Residencial', modalidade: 'Convencional', fimVigencia: '2027-04-21' });
    expect([vigente?.te.toString(), vigente?.tusd.toString(), vigente?.fioB?.toString()]).toEqual(['0.25219', '0.56039', '0.272853']);
    expect(anterior?.fioB).toBeNull();
  });

  it('com linha repetida na ANEEL, vale a publicada por último', () => {
    const repetida = { ...TARIFAS[3], _id: TARIFAS[3]._id + 1, VlrTE: '260,00' };

    const { tarifas } = montarTarifas([repetida, ...TARIFAS], FIO_B);

    expect(tarifas).toHaveLength(6);
    expect(tarifas.find((item) => item.subgrupo === 'B1' && item.inicioVigencia === '2026-04-22')?.te.toString()).toBe('0.26');
  });

  it('recusa unidade diferente de MWh (erro sistemático: vale para a distribuidora inteira)', () => {
    expect(() => montarTarifas([{ ...TARIFAS[0], DscUnidadeTerciaria: 'kWh' }], [])).toThrow(/Unidade inesperada/);
  });

  it('valor ilegível descarta só a linha (a ANEEL tem Fio B em notação científica)', () => {
    const fioBIlegivel = { ...FIO_B[0], VlrComponenteTarifario: '-2,0999999999999999E-8' };

    const { tarifas, descartadas } = montarTarifas(TARIFAS, [fioBIlegivel]);

    expect(tarifas).toHaveLength(6);
    expect(descartadas).toEqual(['Fio B B1 (2026-04-22): valor inválido "-2,0999999999999999E-8"']);
  });
});

describe('validação das tarifas', () => {
  it('aceita as tarifas reais da CPFL Santa Cruz', () => {
    expect(separarTarifasValidas(montarTarifas(TARIFAS, FIO_B).tarifas).descartadas).toEqual([]);
  });

  it.each([
    ['Fio B igual ou maior que a TUSD', { fioB: new Decimal('0.56039') }, /Fio B/],
    ['tarifa B1 fora da faixa, como um valor em MWh lido como kWh', { te: new Decimal('252.19') }, /fora da faixa de 0,10 a 2,00/],
    ['vigência que termina antes de começar', { fimVigencia: '2026-01-01' }, /antes do início/],
  ])('descarta %s e mantém as outras linhas', (_caso, dados, motivo) => {
    const { validas, descartadas } = separarTarifasValidas([tarifa(dados), tarifa({ inicioVigencia: '2025-05-22', fimVigencia: '2026-04-21' })]);

    expect(validas.map((item) => item.inicioVigencia)).toEqual(['2025-05-22']);
    expect(descartadas[0]).toMatch(motivo);
  });

  it('a faixa vale para B1, B2 e B3 (erro de unidade atinge todas as linhas)', () => {
    const { validas } = separarTarifasValidas(['B1', 'B2', 'B3'].map((subgrupo) => tarifa({ subgrupo, te: new Decimal('252.19') })));
    expect(validas).toEqual([]);
  });

  it('aceita as tarifas antigas, de cerca de R$ 0,31 por kWh', () => {
    expect(separarTarifasValidas([tarifa({ te: new Decimal('0.15'), tusd: new Decimal('0.16'), fioB: new Decimal('0.08') })]).descartadas).toEqual([]);
  });
});

describe('comparação com o banco', () => {
  const GRAVADA_2025: TarifaGravada = { ...tarifa({ inicioVigencia: '2025-05-22', fimVigencia: '2025-12-31', fioB: null }), id: 1 };

  it('vigência nova vira linha nova, sem tocar na anterior', () => {
    const { novas, alteradas } = separarNovasEAlteradas([GRAVADA_2025], [tarifa({ inicioVigencia: '2025-05-22', fimVigencia: '2025-12-31', fioB: null }), tarifa()]);

    expect(novas).toEqual([tarifa()]);
    expect(alteradas).toEqual([]);
  });

  it('valor corrigido pela ANEEL atualiza a mesma linha', () => {
    const { novas, alteradas } = separarNovasEAlteradas([GRAVADA_2025], [{ ...GRAVADA_2025, te: new Decimal('0.3') }]);

    expect(novas).toEqual([]);
    expect(alteradas).toHaveLength(1);
    expect(alteradas[0]).toMatchObject({ id: 1 });
    expect(alteradas[0].te.toString()).toBe('0.3');
  });

  it('Fio B ausente na resposta mantém o já gravado', () => {
    const gravada: TarifaGravada = { ...tarifa(), id: 2 };

    expect(separarNovasEAlteradas([gravada], [tarifa({ fioB: null })])).toEqual({ novas: [], alteradas: [] });
  });
});

describe('importarTarifasDaAneel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buscarVersaoDaUltimaImportacao).mockResolvedValue(null);
    vi.mocked(listarTarifasPorCnpj).mockResolvedValue(new Map());
    vi.mocked(listarCnpjsLigados).mockResolvedValue([SANTA_CRUZ]);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('busca B1 a B3 de todas as distribuidoras numa consulta, só a tarifa cheia, com colunas e páginas de 5.000', async () => {
    const fetch = simularAneel();
    vi.stubGlobal('fetch', fetch);

    await importarTarifasDaAneel(CONTEXTO);

    const [consultaDeTarifas, ...consultasDoFioB] = consultasEnviadas(fetch);
    expect(consultaDeTarifas).toMatchObject({
      resource_id: 'fcf2906c-7c32-4b9b-a637-054e7a5234f4',
      filters: {
        DscBaseTarifaria: 'Tarifa de Aplicação', DscSubGrupo: ['B1', 'B2', 'B3'], DscClasse: ['Residencial', 'Rural', 'Não se aplica'],
        DscSubClasse: ['Residencial', 'Não se aplica'], DscModalidadeTarifaria: 'Convencional',
      },
      limit: 5000,
    });
    expect(consultaDeTarifas.filters).not.toHaveProperty('SigAgente');
    expect(consultaDeTarifas.fields).toEqual(expect.arrayContaining(['SigAgente', 'NumCNPJDistribuidora', 'VlrTUSD']));
    // Fio B dos arquivos de componentes que existem entre 2023 e 2026 (a fixture tem 2025 e 2026).
    expect(consultasDoFioB.map((consulta) => consulta.resource_id).sort()).toEqual(['a4060165-3a0c-404f-926c-83901088b67c', 'e8717aa8-2521-453f-bf16-fbb9a16eea39']);
    expect(consultasDoFioB[0].filters).toMatchObject({ DscComponenteTarifario: 'TUSD_FioB' });
  });

  it('grava as distribuidoras ligadas numa gravação só, com a sigla da vigência mais recente', async () => {
    vi.stubGlobal('fetch', simularAneel());

    const resultado = await importarTarifasDaAneel(CONTEXTO);

    const [gravacoes, importacaoId] = vi.mocked(gravarTarifas).mock.calls[0];
    expect(importacaoId).toBe(7);
    expect(gravacoes.map((gravacao) => gravacao.distribuidora)).toEqual([{ cnpj: SANTA_CRUZ, sigla: 'CPFL Santa Cruz' }]);
    expect(gravacoes[0].novas).toHaveLength(6);
    expect(resultado).toMatchObject({ status: 'sucesso', linhasGravadas: 6 });
    expect(resultado.versaoDaFonte).toMatch(/^1 distribuidoras, sha256 [0-9a-f]{32}$/);
  });

  it('distribuidora que não está ligada a município fica de fora', async () => {
    const outra = TARIFAS.map((linha) => ({ ...linha, _id: linha._id + 1_000_000, NumCNPJDistribuidora: '99999999000199', SigAgente: 'OUTRA' }));
    vi.stubGlobal('fetch', simularAneel({ outraDistribuidora: outra }));

    await importarTarifasDaAneel(CONTEXTO);

    expect(vi.mocked(gravarTarifas).mock.calls[0][0].map((gravacao) => gravacao.distribuidora.cnpj)).toEqual([SANTA_CRUZ]);
  });

  it('distribuidora sem nenhuma linha válida segue com as tarifas anteriores, sem barrar as outras', async () => {
    const quebrada = TARIFAS.map((linha) => ({ ...linha, _id: linha._id + 1_000_000, NumCNPJDistribuidora: '99999999000199', SigAgente: 'QUEBRADA', VlrTE: '252190,00' }));
    vi.mocked(listarCnpjsLigados).mockResolvedValue([SANTA_CRUZ, '99999999000199']);
    vi.stubGlobal('fetch', simularAneel({ outraDistribuidora: quebrada }));

    const resultado = await importarTarifasDaAneel(CONTEXTO);

    expect(vi.mocked(gravarTarifas).mock.calls[0][0].map((gravacao) => gravacao.distribuidora.cnpj)).toEqual([SANTA_CRUZ]);
    expect(resultado.mensagem).toMatch(/^1 distribuidoras importadas; descartado: QUEBRADA B1 Residencial \(2025-05-22\): TE \+ TUSD/);
  });

  it('segunda execução sem mudança na ANEEL não baixa nem grava nada', async () => {
    const fetch = simularAneel();
    vi.stubGlobal('fetch', fetch);
    const { versaoDaFonte } = await importarTarifasDaAneel(CONTEXTO);
    fetch.mockClear();
    vi.mocked(gravarTarifas).mockClear();
    vi.mocked(buscarVersaoDaUltimaImportacao).mockResolvedValue(versaoDaFonte ?? null);

    const resultado = await importarTarifasDaAneel(CONTEXTO);

    expect(resultado.status).toBe('sem_alteracao');
    expect(fetch.mock.calls.every(([url]) => String(url).includes('package_show'))).toBe(true);
    expect(gravarTarifas).not.toHaveBeenCalled();
  });

  it('distribuidora nova ligada a município muda a versão e pede reimportação', async () => {
    vi.stubGlobal('fetch', simularAneel());
    const antes = (await importarTarifasDaAneel(CONTEXTO)).versaoDaFonte;
    vi.mocked(listarCnpjsLigados).mockResolvedValue([SANTA_CRUZ, '99999999000199']);

    expect((await importarTarifasDaAneel(CONTEXTO)).versaoDaFonte).not.toBe(antes);
  });

  it('erro no meio da importação não grava nada', async () => {
    vi.stubGlobal('fetch', simularAneel({ falharNoFioB: true }));

    await expect(importarTarifasDaAneel(CONTEXTO)).rejects.toBeInstanceOf(ErroDeIntegracao);
    expect(gravarTarifas).not.toHaveBeenCalled();
  });

  it('sem distribuidoras ligadas, pede a importação aneel-distribuidoras antes', async () => {
    vi.mocked(listarCnpjsLigados).mockResolvedValue([]);
    vi.stubGlobal('fetch', simularAneel());

    await expect(importarTarifasDaAneel(CONTEXTO)).rejects.toThrow(/aneel-distribuidoras/);
  });

  it('no começo do ano, sem o recurso de componentes do ano, usa os anteriores', async () => {
    const fetch = simularAneel();
    vi.stubGlobal('fetch', fetch);

    await importarTarifasDaAneel({ ...CONTEXTO, agora: new Date('2027-01-02T12:00:00Z') });

    expect(consultasEnviadas(fetch).slice(1).map((consulta) => consulta.resource_id)).toContain('e8717aa8-2521-453f-bf16-fbb9a16eea39');
  });
});
