import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarJson, ErroDeIntegracao } from '../integracoes/http.ts';
import { buscarMunicipiosDoBrasil } from '../integracoes/ibge.ts';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

const SEM_ESPERA = { esperaEntreTentativasMs: 0 };

describe('buscarJson', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tenta no máximo 3 vezes quando o servidor falha', async () => {
    const fetch = vi.fn().mockImplementation(async () => respostaJson({}, 503));
    vi.stubGlobal('fetch', fetch);

    await expect(buscarJson('https://exemplo.gov.br/dados', { ...SEM_ESPERA, tentativas: 10 }))
      .rejects.toThrow('exemplo.gov.br não respondeu como esperado (HTTP 503).');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('volta a tentar depois de uma falha de conexão', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(respostaJson({ ok: true }));
    vi.stubGlobal('fetch', fetch);

    await expect(buscarJson('https://exemplo.gov.br/dados', SEM_ESPERA)).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('não repete erro do pedido (4xx), que daria o mesmo resultado', async () => {
    const fetch = vi.fn().mockResolvedValue(respostaJson({}, 404));
    vi.stubGlobal('fetch', fetch);

    await expect(buscarJson('https://exemplo.gov.br/dados', SEM_ESPERA)).rejects.toThrow(/HTTP 404/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('envia um timeout em cada tentativa e avisa quando o tempo esgota', async () => {
    const fetch = vi.fn().mockImplementation(async (_url: string, opcoes: RequestInit) => {
      expect(opcoes.signal).toBeInstanceOf(AbortSignal);
      throw new DOMException('tempo', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetch);

    await expect(buscarJson('https://exemplo.gov.br/dados', SEM_ESPERA)).rejects.toThrow(/tempo esgotado/);
  });
});

describe('IBGE', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('busca todos os municípios do Brasil numa chamada, na visão nivelada', async () => {
    const fetch = vi.fn().mockResolvedValue(respostaJson([
      { 'municipio-id': 3530508, 'municipio-nome': 'Mococa', 'UF-sigla': 'SP', 'microrregiao-nome': 'São João da Boa Vista' },
      { 'municipio-id': 5101837, 'municipio-nome': 'Boa Esperança do Norte', 'UF-sigla': 'MT' },
    ]));
    vi.stubGlobal('fetch', fetch);

    const municipios = await buscarMunicipiosDoBrasil();

    expect(fetch.mock.calls[0][0]).toBe('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado');
    expect(municipios).toEqual([
      { codigoIbge: 3530508, nome: 'Mococa', uf: 'SP' },
      { codigoIbge: 5101837, nome: 'Boa Esperança do Norte', uf: 'MT' },
    ]);
  });

  it('recusa resposta num formato inesperado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson([{ id: 35, nome: 'X' }])));

    await expect(buscarMunicipiosDoBrasil()).rejects.toBeInstanceOf(ErroDeIntegracao);
  });
});
