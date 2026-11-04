import path from 'node:path';
import { Decimal } from 'decimal.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { salvarIrradiacoes } from '../repositories/irradiacaoRepository.ts';
import { listarTodosOsMunicipios } from '../repositories/municipiosRepository.ts';
import {
  carregarAtlas, casarComMunicipios, lerCsvDoAtlas, normalizarNome, verificarIrradiacao, type LinhaDoAtlas,
} from '../services/atlasService.ts';

vi.mock('../repositories/municipiosRepository.ts', () => ({ listarTodosOsMunicipios: vi.fn() }));
vi.mock('../repositories/irradiacaoRepository.ts', () => ({ salvarIrradiacoes: vi.fn() }));

const CSV_DE_EXEMPLO = path.join(import.meta.dirname, 'fixtures', 'atlas-sedes-exemplo.csv');
const CSV_SEM_MESES = path.join(import.meta.dirname, 'fixtures', 'atlas-sem-meses.csv');

const MUNICIPIOS = [
  { codigoIbge: 1200104, nome: 'Brasiléia', uf: 'AC' },
  { codigoIbge: 3530508, nome: 'Mococa', uf: 'SP' },
  { codigoIbge: 3549706, nome: 'São José do Rio Pardo', uf: 'SP' },
  { codigoIbge: 3516101, nome: 'Florínea', uf: 'SP' },
  { codigoIbge: 3539301, nome: 'Pirassununga', uf: 'SP' },
  { codigoIbge: 3510807, nome: 'Casa Branca', uf: 'SP' },
];

const SEM_CORRECOES = { nomes: {}, semSedeNoAtlas: {} };
const CORRECAO_DE_FLORINEA = { nomes: { SP: { 'Florínia': 3516101 } }, semSedeNoAtlas: {} };

function linhaComHsp(nome: string, mensal: string[], anual: string, uf = 'SP'): LinhaDoAtlas {
  return { nome, uf, hspAnual: new Decimal(anual), hspMensal: mensal.map((valor) => new Decimal(valor)) };
}

const MESES_DE_MOCOCA = ['5.099', '5.569', '5.31', '5.47', '5', '4.881', '5.072', '5.76', '5.326', '5.407', '5.252', '5.251'];

describe('leitura do CSV do Atlas', () => {
  it('lê as sedes de todas as UFs e converte Wh/m² por dia em HSP', async () => {
    const linhas = await lerCsvDoAtlas(CSV_DE_EXEMPLO);

    expect(linhas.find((linha) => linha.nome === 'Brasiléia')?.uf).toBe('AC');
    const mococa = linhas.find((linha) => linha.nome === 'Mococa');
    expect(mococa?.hspAnual.toString()).toBe('5.283');
    expect(mococa?.hspMensal.map(String)).toEqual([
      '5.099', '5.569', '5.31', '5.47', '5', '4.881', '5.072', '5.76', '5.326', '5.407', '5.252', '5.251',
    ]);
  });

  it('recusa um CSV sem as colunas dos meses', async () => {
    await expect(lerCsvDoAtlas(CSV_SEM_MESES)).rejects.toThrow(/faltam as colunas JAN/);
  });
});

describe('verificação da irradiação', () => {
  const MESES_TIPICOS = ['5.1', '5.6', '5.3', '5.5', '5.0', '4.9', '5.1', '5.8', '5.3', '5.4', '5.3', '5.2'];

  it('aceita HSP entre 2,0 e 8,0 com média próxima do anual', () => {
    expect(verificarIrradiacao(linhaComHsp('Mococa', MESES_TIPICOS, '5.29'))).toBeNull();
  });

  it('recusa mês abaixo de 2,0 ou acima de 8,0', () => {
    expect(verificarIrradiacao(linhaComHsp('A', ['1.9', ...MESES_TIPICOS.slice(1)], '5.0'))).toMatch(/fora da faixa/);
    expect(verificarIrradiacao(linhaComHsp('B', [...MESES_TIPICOS.slice(1), '8.1'], '5.5'))).toMatch(/fora da faixa/);
  });

  it('recusa média dos meses distante do anual', () => {
    expect(verificarIrradiacao(linhaComHsp('C', MESES_TIPICOS, '5.6'))).toMatch(/difere do anual/);
  });
});

describe('casamento com os municípios', () => {
  it('ignora acentos, maiúsculas e pontuação no nome', () => {
    expect(normalizarNome("São João d'Aliança")).toBe(normalizarNome('Sao Joao D Alianca'));
  });

  it('casa pelo nome sem acento, aplica as correções e lista o que sobrou', async () => {
    const linhas = await lerCsvDoAtlas(CSV_DE_EXEMPLO);
    const resultado = casarComMunicipios(linhas, MUNICIPIOS, CORRECAO_DE_FLORINEA);

    expect(resultado.irradiacoes.map((irradiacao) => irradiacao.codigoIbge).sort()).toEqual([1200104, 3516101, 3530508, 3549706]);
    expect(resultado.linhasRecusadas).toEqual(['Pirassununga/SP: HSP mensal fora da faixa de 2,0 a 8,0']);
    expect(resultado.linhasSemMunicipio).toEqual(['Cidade Inexistente/SP']);
    expect(resultado.municipiosSemIrradiacao.map((municipio) => municipio.nome)).toEqual(['Pirassununga', 'Casa Branca']);
  });

  it('todo HSP gravado tem 12 meses entre 2,0 e 8,0', async () => {
    const { irradiacoes } = casarComMunicipios(await lerCsvDoAtlas(CSV_DE_EXEMPLO), MUNICIPIOS);

    for (const { hspMensal } of irradiacoes) {
      expect(hspMensal).toHaveLength(12);
      expect(hspMensal.every((hsp) => hsp.gte(2) && hsp.lte(8))).toBe(true);
    }
  });

  it('sem a correção, o nome diferente fica sem município', async () => {
    const resultado = casarComMunicipios(await lerCsvDoAtlas(CSV_DE_EXEMPLO), MUNICIPIOS, SEM_CORRECOES);

    expect(resultado.linhasSemMunicipio).toContain('Florínia/SP');
    expect(resultado.municipiosSemIrradiacao.map((municipio) => municipio.nome)).toContain('Florínea');
  });
});

describe('casamento no país inteiro', () => {
  it('o nome só casa dentro da mesma UF', () => {
    const resultado = casarComMunicipios([linhaComHsp('Mococa', MESES_DE_MOCOCA, '5.283')], [{ codigoIbge: 3199999, nome: 'Mococa', uf: 'MG' }]);

    expect(resultado.irradiacoes).toEqual([]);
    expect(resultado.linhasSemMunicipio).toEqual(['Mococa/SP']);
  });

  it('a correção pode apontar para outra UF (Porto Alegre está com a UF do RN no Atlas)', () => {
    const portoAlegre = { codigoIbge: 4314902, nome: 'Porto Alegre', uf: 'RS' };
    const correcoes = { nomes: { RN: { 'Porto Alegre': 4314902 } }, semSedeNoAtlas: {} };

    const resultado = casarComMunicipios([linhaComHsp('Porto Alegre', MESES_DE_MOCOCA, '5.283', 'RN')], [portoAlegre], correcoes);

    expect(resultado.irradiacoes.map((irradiacao) => irradiacao.codigoIbge)).toEqual([4314902]);
  });

  it('município fora do Atlas usa a sede indicada na correção', () => {
    const municipios = [{ codigoIbge: 5107925, nome: 'Sorriso', uf: 'MT' }, { codigoIbge: 5101837, nome: 'Boa Esperança do Norte', uf: 'MT' }];
    const correcoes = { nomes: {}, semSedeNoAtlas: { 5101837: { usarSedeDe: 5107925, motivo: 'criado depois de 2017' } } };

    const resultado = casarComMunicipios([linhaComHsp('Sorriso', MESES_DE_MOCOCA, '5.283', 'MT')], municipios, correcoes);

    expect(resultado.municipiosSemIrradiacao).toEqual([]);
    const [sorriso, boaEsperanca] = resultado.irradiacoes;
    expect(boaEsperanca.codigoIbge).toBe(5101837);
    expect(boaEsperanca.hspMensal.map(String)).toEqual(sorriso.hspMensal.map(String));
  });
});

describe('carregarAtlas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grava as irradiações que casaram com os municípios do país', async () => {
    vi.mocked(listarTodosOsMunicipios).mockResolvedValue(MUNICIPIOS);

    const resultado = await carregarAtlas(CSV_DE_EXEMPLO);

    expect(salvarIrradiacoes).toHaveBeenCalledWith(resultado.irradiacoes);
    // Brasiléia (AC), Mococa, São José do Rio Pardo e Florínea (pela tabela de correções do projeto).
    expect(resultado.irradiacoes).toHaveLength(4);
  });

  it('pede para carregar os municípios antes, se a tabela estiver vazia', async () => {
    vi.mocked(listarTodosOsMunicipios).mockResolvedValue([]);

    await expect(carregarAtlas(CSV_DE_EXEMPLO)).rejects.toThrow(/npm run carregar-municipios/);
    expect(salvarIrradiacoes).not.toHaveBeenCalled();
  });
});
