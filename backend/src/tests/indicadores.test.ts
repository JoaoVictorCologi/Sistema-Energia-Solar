import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroDeImportacao } from '../jobs/tipos.ts';
import { buscarUltimaDataDaSerie, gravarIndicadores } from '../repositories/indicadoresRepository.ts';
import { converterValores, importarIndicadores, SERIES } from '../services/indicadoresService.ts';

vi.mock('../repositories/indicadoresRepository.ts', () => ({ buscarUltimaDataDaSerie: vi.fn(), gravarIndicadores: vi.fn() }));

// 03/11/2026 às 01:00 em UTC ainda é 02/11 em São Paulo.
const CONTEXTO = { importacaoId: 3, agora: new Date('2026-11-03T01:00:00Z') };

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function serieDaUrl(url: string): number {
  return Number(/bcdata\.sgs\.(\d+)\//.exec(url)?.[1]);
}

// O SGS responde 404 quando não há valor no período.
function simularBancoCentral(valores: Record<number, { data: string; valor: string }[]>) {
  return vi.fn(async (url: string) => {
    const lista = valores[serieDaUrl(url)] ?? [];
    return lista.length ? respostaJson(lista) : respostaJson({ erro: { statusCode: 404 } }, 404);
  });
}

describe('conversão das séries', () => {
  const IPCA_MENSAL = SERIES[0];

  it('converte o valor em Decimal e mantém a data', () => {
    const [indicador] = converterValores(IPCA_MENSAL, [{ data: '2026-09-01', valor: '0.82' }]);

    expect(indicador.serie).toBe(433);
    expect(indicador.data).toBe('2026-09-01');
    expect(indicador.valor.toString()).toBe('0.82');
  });

  it('recusa valor fora da faixa da série', () => {
    expect(() => converterValores(IPCA_MENSAL, [{ data: '2026-09-01', valor: '82' }])).toThrow(ErroDeImportacao);
  });
});

describe('importarIndicadores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gravarIndicadores).mockImplementation(async (indicadores) => indicadores.length);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('na primeira carga pede 2 anos, com data inicial e final, até hoje em São Paulo', async () => {
    vi.mocked(buscarUltimaDataDaSerie).mockResolvedValue(null);
    const fetch = simularBancoCentral({ 433: [{ data: '01/09/2026', valor: '0.82' }] });
    vi.stubGlobal('fetch', fetch);

    const resultado = await importarIndicadores(CONTEXTO);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0][0]).toBe('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=02/11/2024&dataFinal=02/11/2026');
    expect(resultado).toEqual({ status: 'sucesso', linhasGravadas: 1 });
    expect(gravarIndicadores).toHaveBeenCalledWith([expect.objectContaining({ serie: 433, data: '2026-09-01' })], 3);
  });

  it('depois, pede só a partir do dia seguinte ao último gravado', async () => {
    vi.mocked(buscarUltimaDataDaSerie).mockResolvedValue('2026-09-01');
    const fetch = simularBancoCentral({});
    vi.stubGlobal('fetch', fetch);

    await importarIndicadores(CONTEXTO);

    expect(fetch.mock.calls[0][0]).toContain('dataInicial=02/09/2026&dataFinal=02/11/2026');
  });

  it('sem valor novo (404 ou o último valor repetido) registra "sem alteração"', async () => {
    vi.mocked(buscarUltimaDataDaSerie).mockResolvedValue('2026-09-01');
    // O SGS devolve o último valor de uma série mensal mesmo quando ele é anterior ao período pedido.
    vi.stubGlobal('fetch', simularBancoCentral({ 13522: [{ data: '01/09/2026', valor: '4.58' }] }));
    vi.mocked(gravarIndicadores).mockResolvedValue(0);

    const resultado = await importarIndicadores(CONTEXTO);

    expect(resultado).toEqual({ status: 'sem_alteracao', linhasGravadas: 0 });
    expect(gravarIndicadores).toHaveBeenCalledWith([], 3);
  });

  it('não consulta a série cuja última data já passou de hoje', async () => {
    vi.mocked(buscarUltimaDataDaSerie).mockImplementation(async (serie) => (serie === 432 ? '2026-11-04' : '2026-09-01'));
    const fetch = simularBancoCentral({});
    vi.stubGlobal('fetch', fetch);

    await importarIndicadores(CONTEXTO);

    expect(fetch.mock.calls.map(([url]) => serieDaUrl(url))).toEqual([433, 13522]);
  });

  it('valor inválido em qualquer série não grava nenhuma', async () => {
    vi.mocked(buscarUltimaDataDaSerie).mockResolvedValue(null);
    vi.stubGlobal('fetch', simularBancoCentral({
      433: [{ data: '01/09/2026', valor: '0.82' }],
      432: [{ data: '02/11/2026', valor: '1375' }],
    }));

    await expect(importarIndicadores(CONTEXTO)).rejects.toThrow(/Selic meta/);
    expect(gravarIndicadores).not.toHaveBeenCalled();
  });
});
