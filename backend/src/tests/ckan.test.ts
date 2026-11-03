import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarRecursosDoPacote, percorrerDatastore } from '../integracoes/ckan.ts';
import { ErroDeIntegracao } from '../integracoes/http.ts';

const PASTA_DAS_FIXTURES = path.join(import.meta.dirname, 'fixtures', 'aneel');

function lerFixture(nome: string): unknown {
  return JSON.parse(readFileSync(path.join(PASTA_DAS_FIXTURES, nome), 'utf8'));
}

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function paginaCom(quantidade: number) {
  return { success: true, result: { records: Array.from({ length: quantidade }, (_, indice) => ({ _id: indice })) } };
}

function corpoDaChamada(fetch: ReturnType<typeof vi.fn>, indice: number): Record<string, unknown> {
  return JSON.parse((fetch.mock.calls[indice][1] as RequestInit).body as string);
}

const CONSULTA = {
  recursoId: 'recurso-1',
  filtros: { SigAgente: 'CPFL Santa Cruz', DscSubGrupo: ['B1', 'B2', 'B3'] },
  campos: ['_id', 'VlrTE'],
  tamanhoDaPagina: 2,
};

describe('cliente CKAN', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lista os recursos do conjunto com a data de modificação', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(lerFixture('package_show-tarifas.json'))));

    const recursos = await buscarRecursosDoPacote('tarifas-distribuidoras-energia-eletrica');

    expect(recursos).toContainEqual({
      id: 'fcf2906c-7c32-4b9b-a637-054e7a5234f4',
      nome: 'tarifas-homologadas-distribuidoras-energia-eletrica.csv',
      formato: 'CSV',
      datastoreAtivo: true,
      modificadoEm: '2026-11-02T11:07:53.210106',
    });
  });

  it('envia filtros, colunas, limite e ordenação por _id em POST', async () => {
    const fetch = vi.fn().mockResolvedValue(respostaJson(paginaCom(1)));
    vi.stubGlobal('fetch', fetch);

    await percorrerDatastore(CONSULTA, () => {});

    expect(fetch.mock.calls[0][0]).toBe('https://dadosabertos.aneel.gov.br/api/3/action/datastore_search');
    expect((fetch.mock.calls[0][1] as RequestInit).method).toBe('POST');
    expect(corpoDaChamada(fetch, 0)).toEqual({
      resource_id: 'recurso-1',
      filters: CONSULTA.filtros,
      fields: ['_id', 'VlrTE'],
      sort: '_id asc',
      limit: 2,
      offset: 0,
    });
  });

  it('aceita distinct, ordenando pelas colunas pedidas', async () => {
    const fetch = vi.fn().mockResolvedValue(respostaJson(paginaCom(0)));
    vi.stubGlobal('fetch', fetch);

    await percorrerDatastore({ ...CONSULTA, campos: ['CodMunicipioIbge', 'SigAgente'], distinct: true }, () => {});

    expect(corpoDaChamada(fetch, 0)).toMatchObject({ distinct: true, sort: 'CodMunicipioIbge, SigAgente' });
  });

  it('entrega página a página e para quando a página vem incompleta', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(respostaJson(paginaCom(2)))
      .mockResolvedValueOnce(respostaJson(paginaCom(2)))
      .mockResolvedValueOnce(respostaJson(paginaCom(1)));
    vi.stubGlobal('fetch', fetch);
    const tamanhos: number[] = [];

    await percorrerDatastore(CONSULTA, (registros) => { tamanhos.push(registros.length); });

    expect(tamanhos).toEqual([2, 2, 1]);
    expect([0, 1, 2].map((indice) => corpoDaChamada(fetch, indice).offset)).toEqual([0, 2, 4]);
  });

  it('para no limite de páginas com erro, em vez de seguir baixando', async () => {
    const fetch = vi.fn().mockImplementation(async () => respostaJson(paginaCom(2)));
    vi.stubGlobal('fetch', fetch);

    await expect(percorrerDatastore({ ...CONSULTA, limiteDePaginas: 3 }, () => {})).rejects.toThrow(/passou de 3 páginas/);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('recusa resposta sem success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({ success: false, error: { message: 'x' } })));

    await expect(percorrerDatastore(CONSULTA, () => {})).rejects.toBeInstanceOf(ErroDeIntegracao);
  });
});
