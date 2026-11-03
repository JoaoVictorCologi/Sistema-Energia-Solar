import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroDeImportacao } from '../jobs/tipos.ts';
import { substituirVinculos } from '../repositories/distribuidorasRepository.ts';
import { buscarVersaoDaUltimaImportacao } from '../repositories/importacoesRepository.ts';
import { listarTodosOsMunicipios } from '../repositories/municipiosRepository.ts';
import { importarDistribuidorasDosMunicipios, montarVinculos } from '../services/distribuidorasService.ts';

vi.mock('../repositories/distribuidorasRepository.ts', () => ({ substituirVinculos: vi.fn() }));
vi.mock('../repositories/importacoesRepository.ts', () => ({ buscarVersaoDaUltimaImportacao: vi.fn() }));
vi.mock('../repositories/municipiosRepository.ts', () => ({ listarTodosOsMunicipios: vi.fn() }));

const SANTA_CRUZ = '53859112000169';
const ELETROPAULO = '61695227000193';
const CERIS = '57384943000182';
// Formato real: nos limites, CNPJ e conjunto são números (e o CNPJ perde o zero à esquerda); nos municípios, texto.
const LIMITES_2026 = [
  { SigAgente: 'CPFL JAGUARI', NumCNPJ: 53859112000169, IdeConjUndConsumidoras: 15001 },
  { SigAgente: 'ELETROPAULO', NumCNPJ: 61695227000193, IdeConjUndConsumidoras: 20001 },
  { SigAgente: 'ELETROPAULO', NumCNPJ: 61695227000193, IdeConjUndConsumidoras: 20002 },
  { SigAgente: 'CERIS', NumCNPJ: 57384943000182, IdeConjUndConsumidoras: 30001 },
  { SigAgente: 'CEEE-D', NumCNPJ: 8467115000100, IdeConjUndConsumidoras: 40001 },
];
const MUNICIPIOS_DA_QUALIDADE = [
  { CodMunicipio: '3530508', IdeConjUnidConsumidoras: '15001' },
  { CodMunicipio: '3530508', IdeConjUnidConsumidoras: '999' },
  { CodMunicipio: '3550308', IdeConjUnidConsumidoras: '20001' },
  { CodMunicipio: '3550308', IdeConjUnidConsumidoras: '20002' },
  { CodMunicipio: '3550308', IdeConjUnidConsumidoras: '30001' },
  { CodMunicipio: '4314902', IdeConjUnidConsumidoras: '40001' },
];
const MUNICIPIOS = [3530508, 3550308, 4314902].map((codigoIbge) => ({ codigoIbge, nome: String(codigoIbge), uf: 'SP' }));

function conjuntosDoAno() {
  return LIMITES_2026.map((linha) => ({ conjunto: String(linha.IdeConjUndConsumidoras), cnpj: String(linha.NumCNPJ).padStart(14, '0'), sigla: linha.SigAgente }));
}

function conjuntosDosMunicipios() {
  return MUNICIPIOS_DA_QUALIDADE.map((linha) => ({ codigoIbge: Number(linha.CodMunicipio), conjunto: linha.IdeConjUnidConsumidoras }));
}

function respostaJson(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { headers: { 'Content-Type': 'application/json' } });
}

const PACOTES: Record<string, object> = {
  'indicadores-coletivos-de-continuidade-dec-e-fec': { id: 'limites-1', name: 'indicadores-continuidade-coletivos-limite', format: 'CSV', datastore_active: true, last_modified: '2026-10-05T05:20:57' },
  'indqual-municipio': { id: 'municipios-1', name: 'indqual-municipio', format: 'CSV', datastore_active: true, last_modified: '2026-10-23T12:51:04' },
};

function simularAneel() {
  return vi.fn(async (url: string, opcoes?: RequestInit) => {
    const pacote = /package_show\?id=(.+)$/.exec(url)?.[1];
    if (pacote) return respostaJson({ success: true, result: { resources: [PACOTES[pacote]] } });
    const corpo = JSON.parse(opcoes?.body as string);
    return respostaJson({ success: true, result: { records: corpo.resource_id === 'limites-1' ? LIMITES_2026 : MUNICIPIOS_DA_QUALIDADE } });
  });
}

const CONTEXTO = { importacaoId: 9, agora: new Date('2026-11-03T12:00:00Z') };

describe('montagem dos vínculos', () => {
  const vinculos = montarVinculos(conjuntosDoAno(), conjuntosDosMunicipios(), new Set(MUNICIPIOS.map((municipio) => municipio.codigoIbge)));

  it('liga pelo CNPJ, mesmo com a sigla antiga nos indicadores (CPFL JAGUARI = CPFL Santa Cruz)', () => {
    expect(vinculos.filter((vinculo) => vinculo.codigoIbge === 3530508)).toEqual([{ codigoIbge: 3530508, cnpj: SANTA_CRUZ, sigla: 'CPFL JAGUARI', conjuntos: 1, sugerida: true }]);
  });

  it('conjunto antigo (sem limite no ano) não conta', () => {
    expect(vinculos.filter((vinculo) => vinculo.codigoIbge === 3530508)).toHaveLength(1);
  });

  it('com mais de uma distribuidora, sugere a de mais conjuntos', () => {
    expect(vinculos.filter((vinculo) => vinculo.codigoIbge === 3550308).map(({ cnpj, conjuntos, sugerida }) => [cnpj, conjuntos, sugerida])).toEqual([
      [ELETROPAULO, 2, true], [CERIS, 1, false],
    ]);
  });

  it('CNPJ que perdeu o zero à esquerda volta a ter 14 dígitos', () => {
    expect(vinculos.find((vinculo) => vinculo.codigoIbge === 4314902)?.cnpj).toBe('08467115000100');
  });

  it('em empate, sugere a de menor CNPJ (resultado não depende da ordem da API)', () => {
    const empate = montarVinculos(
      [{ conjunto: '1', cnpj: '22222222000122', sigla: 'B' }, { conjunto: '2', cnpj: '11111111000111', sigla: 'A' }],
      [{ codigoIbge: 3530508, conjunto: '1' }, { codigoIbge: 3530508, conjunto: '2' }], new Set([3530508]),
    );
    expect(empate.find((vinculo) => vinculo.sugerida)?.cnpj).toBe('11111111000111');
  });

  it('município que não está no banco é ignorado', () => {
    expect(montarVinculos(conjuntosDoAno(), [{ codigoIbge: 9999999, conjunto: '15001' }], new Set([3530508]))).toEqual([]);
  });
});

describe('importarDistribuidorasDosMunicipios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(buscarVersaoDaUltimaImportacao).mockResolvedValue(null);
    vi.mocked(listarTodosOsMunicipios).mockResolvedValue(MUNICIPIOS);
  });

  it('pede só as colunas usadas, com distinct, o ano corrente e páginas de 5.000', async () => {
    const fetch = simularAneel();
    vi.stubGlobal('fetch', fetch);

    await importarDistribuidorasDosMunicipios(CONTEXTO);

    const consultas = fetch.mock.calls.filter(([url]) => String(url).endsWith('datastore_search')).map(([, opcoes]) => JSON.parse((opcoes as RequestInit).body as string));
    expect(consultas).toContainEqual(expect.objectContaining({
      resource_id: 'limites-1', filters: { AnoLimiteQualidade: 2026 }, fields: ['SigAgente', 'NumCNPJ', 'IdeConjUndConsumidoras'], distinct: true, limit: 5000,
    }));
    expect(consultas).toContainEqual(expect.objectContaining({ resource_id: 'municipios-1', fields: ['CodMunicipio', 'IdeConjUnidConsumidoras'], distinct: true }));
  });

  it('troca todos os vínculos de uma vez, ligados a esta importação', async () => {
    vi.stubGlobal('fetch', simularAneel());

    const resultado = await importarDistribuidorasDosMunicipios(CONTEXTO);

    expect(resultado).toMatchObject({ status: 'sucesso', linhasGravadas: 4 });
    expect(vi.mocked(substituirVinculos).mock.calls[0][1]).toBe(9);
  });

  it('sem mudança na fonte, não baixa nem grava', async () => {
    const fetch = simularAneel();
    vi.stubGlobal('fetch', fetch);
    vi.mocked(buscarVersaoDaUltimaImportacao).mockResolvedValue('limites 2026 2026-10-05T05:20:57 | municípios 2026-10-23T12:51:04');

    expect((await importarDistribuidorasDosMunicipios(CONTEXTO)).status).toBe('sem_alteracao');
    expect(fetch.mock.calls.every(([url]) => String(url).includes('package_show'))).toBe(true);
    expect(substituirVinculos).not.toHaveBeenCalled();
  });

  it('resposta que ligaria menos de 90% dos municípios é recusada e mantém os vínculos anteriores', async () => {
    vi.stubGlobal('fetch', simularAneel());
    vi.mocked(listarTodosOsMunicipios).mockResolvedValue([...MUNICIPIOS, { codigoIbge: 1100015, nome: 'Alta Floresta D\'Oeste', uf: 'RO' }]);

    await expect(importarDistribuidorasDosMunicipios(CONTEXTO)).rejects.toBeInstanceOf(ErroDeImportacao);
    expect(substituirVinculos).not.toHaveBeenCalled();
  });
});
