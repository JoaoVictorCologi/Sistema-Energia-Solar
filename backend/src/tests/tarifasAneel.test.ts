import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Decimal } from 'decimal.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FioBDaAneel, TarifaDaAneel } from '../integracoes/aneel.ts';
import { ErroDeIntegracao } from '../integracoes/http.ts';
import { ErroDeImportacao } from '../jobs/tipos.ts';
import { buscarVersaoDaUltimaImportacao } from '../repositories/importacoesRepository.ts';
import { gravarTarifas, listarTarifasDaDistribuidora, type DadosDaTarifa, type TarifaGravada } from '../repositories/tarifasRepository.ts';
import {
  converterValorDaAneel, importarTarifasDaAneel, montarTarifas, separarNovasEAlteradas, validarTarifas,
} from '../services/tarifasAneelService.ts';

vi.mock('../repositories/importacoesRepository.ts', () => ({ buscarVersaoDaUltimaImportacao: vi.fn() }));
vi.mock('../repositories/tarifasRepository.ts', () => ({ listarTarifasDaDistribuidora: vi.fn(), gravarTarifas: vi.fn() }));

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
function simularAneel({ falharNoFioB = false } = {}) {
  return vi.fn(async (url: string, opcoes?: RequestInit) => {
    if (url.endsWith('package_show?id=tarifas-distribuidoras-energia-eletrica')) return respostaJson(lerFixture('package_show-tarifas.json'));
    if (url.endsWith('package_show?id=componentes-tarifarias')) return respostaJson(lerFixture('package_show-componentes.json'));
    const corpo = JSON.parse(opcoes?.body as string);
    if (corpo.filters.DscComponenteTarifario === 'TUSD_FioB') {
      return falharNoFioB ? respostaJson({}, 400) : respostaJson(lerFixture('datastore_search-fio-b.json'));
    }
    return respostaJson(lerFixture('datastore_search-tarifas.json'));
  });
}

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
    const tarifas = montarTarifas(TARIFAS, FIO_B);
    const vigente = tarifas.find((item) => item.subgrupo === 'B1' && item.inicioVigencia === '2026-04-22');
    const anterior = tarifas.find((item) => item.subgrupo === 'B1' && item.inicioVigencia === '2025-05-22');

    expect(tarifas).toHaveLength(6);
    expect(vigente).toMatchObject({ classe: 'Residencial', subclasse: 'Residencial', modalidade: 'Convencional', fimVigencia: '2027-04-21' });
    expect([vigente?.te.toString(), vigente?.tusd.toString(), vigente?.fioB?.toString()]).toEqual(['0.25219', '0.56039', '0.272853']);
    expect(anterior?.fioB).toBeNull();
  });

  it('com linha repetida na ANEEL, vale a publicada por último', () => {
    const repetida = { ...TARIFAS[3], _id: TARIFAS[3]._id + 1, VlrTE: '260,00' };

    const tarifas = montarTarifas([repetida, ...TARIFAS], FIO_B);

    expect(tarifas).toHaveLength(6);
    expect(tarifas.find((item) => item.subgrupo === 'B1' && item.inicioVigencia === '2026-04-22')?.te.toString()).toBe('0.26');
  });

  it('recusa unidade diferente de MWh', () => {
    expect(() => montarTarifas([{ ...TARIFAS[0], DscUnidadeTerciaria: 'kWh' }], [])).toThrow(/Unidade inesperada/);
  });
});

describe('validação das tarifas', () => {
  it('aceita as tarifas reais da CPFL Santa Cruz', () => {
    expect(() => validarTarifas(montarTarifas(TARIFAS, FIO_B))).not.toThrow();
  });

  it('recusa Fio B igual ou maior que a TUSD', () => {
    expect(() => validarTarifas([tarifa({ fioB: new Decimal('0.56039') })])).toThrow(/Fio B/);
  });

  it('recusa tarifa B1 fora da faixa, como um valor em MWh lido como kWh', () => {
    expect(() => validarTarifas([tarifa({ te: new Decimal('252.19') })])).toThrow(/fora da faixa/);
  });

  it('recusa vigência que termina antes de começar', () => {
    expect(() => validarTarifas([tarifa({ fimVigencia: '2026-01-01' })])).toThrow(/antes do início/);
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
    vi.mocked(listarTarifasDaDistribuidora).mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('busca só a distribuidora, B1 a B3, convencional, com colunas e limite, e grava as tarifas', async () => {
    const fetch = simularAneel();
    vi.stubGlobal('fetch', fetch);

    const resultado = await importarTarifasDaAneel(CONTEXTO);

    const consultaDeTarifas = JSON.parse((fetch.mock.calls[2][1] as RequestInit).body as string);
    expect(consultaDeTarifas).toMatchObject({
      resource_id: 'fcf2906c-7c32-4b9b-a637-054e7a5234f4',
      filters: { SigAgente: 'CPFL Santa Cruz', DscBaseTarifaria: 'Tarifa de Aplicação', DscSubGrupo: ['B1', 'B2', 'B3'], DscModalidadeTarifaria: 'Convencional' },
      limit: 1000,
    });
    expect(consultaDeTarifas.fields).toContain('VlrTUSD');
    const consultaDoFioB = JSON.parse((fetch.mock.calls[3][1] as RequestInit).body as string);
    expect(consultaDoFioB).toMatchObject({ resource_id: 'e8717aa8-2521-453f-bf16-fbb9a16eea39', filters: { NumCPFCNPJ: '53859112000169', DscComponenteTarifario: 'TUSD_FioB' } });

    expect(gravarTarifas).toHaveBeenCalledWith(expect.objectContaining({
      distribuidora: { sigla: 'CPFL Santa Cruz', cnpj: '53859112000169' }, importacaoId: 7, alteradas: [],
    }));
    expect(vi.mocked(gravarTarifas).mock.calls[0][0].novas).toHaveLength(6);
    expect(resultado).toEqual({
      status: 'sucesso',
      linhasGravadas: 6,
      versaoDaFonte: 'CPFL Santa Cruz | tarifas 2026-11-02T11:07:53.210106 | componentes 2026 2026-11-02T08:24:31.536556',
    });
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

  it('erro no meio da importação não grava nada', async () => {
    vi.stubGlobal('fetch', simularAneel({ falharNoFioB: true }));

    await expect(importarTarifasDaAneel(CONTEXTO)).rejects.toBeInstanceOf(ErroDeIntegracao);
    expect(gravarTarifas).not.toHaveBeenCalled();
  });

  it('distribuidora sem tarifas na ANEEL é um erro que aponta o parametros.json', async () => {
    const fetch = simularAneel();
    fetch.mockImplementation(async (url: string) => (url.includes('package_show')
      ? respostaJson(lerFixture(url.endsWith('componentes-tarifarias') ? 'package_show-componentes.json' : 'package_show-tarifas.json'))
      : respostaJson({ success: true, result: { records: [] } })));
    vi.stubGlobal('fetch', fetch);

    await expect(importarTarifasDaAneel(CONTEXTO)).rejects.toThrow(/distribuidoraPadrao/);
  });

  it('no começo do ano, sem o recurso de componentes do ano, usa o do ano anterior', async () => {
    vi.stubGlobal('fetch', simularAneel());

    const resultado = await importarTarifasDaAneel({ ...CONTEXTO, agora: new Date('2027-01-02T12:00:00Z') });

    expect(resultado.versaoDaFonte).toContain('componentes 2026');
  });
});
