import path from 'node:path';
import { Decimal } from 'decimal.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { salvarIrradiacoes } from '../repositories/irradiacaoRepository.ts';
import { listarMunicipiosDaUf } from '../repositories/municipiosRepository.ts';
import {
  carregarAtlas, casarComMunicipios, lerCsvDoAtlas, normalizarNome, verificarIrradiacao, type LinhaDoAtlas,
} from '../services/atlasService.ts';

vi.mock('../repositories/municipiosRepository.ts', () => ({ listarMunicipiosDaUf: vi.fn() }));
vi.mock('../repositories/irradiacaoRepository.ts', () => ({ salvarIrradiacoes: vi.fn() }));

const CSV_DE_EXEMPLO = path.join(import.meta.dirname, 'fixtures', 'atlas-sedes-exemplo.csv');
const CSV_SEM_MESES = path.join(import.meta.dirname, 'fixtures', 'atlas-sem-meses.csv');

const MUNICIPIOS_SP = [
  { codigoIbge: 3530508, nome: 'Mococa', uf: 'SP' },
  { codigoIbge: 3549706, nome: 'São José do Rio Pardo', uf: 'SP' },
  { codigoIbge: 3516101, nome: 'Florínea', uf: 'SP' },
  { codigoIbge: 3539301, nome: 'Pirassununga', uf: 'SP' },
  { codigoIbge: 3510807, nome: 'Casa Branca', uf: 'SP' },
];

function linhaComHsp(nome: string, mensal: string[], anual: string): LinhaDoAtlas {
  return { nome, uf: 'SP', hspAnual: new Decimal(anual), hspMensal: mensal.map((valor) => new Decimal(valor)) };
}

describe('leitura do CSV do Atlas', () => {
  it('lê só as linhas da UF e converte Wh/m² por dia em HSP', async () => {
    const linhas = await lerCsvDoAtlas(CSV_DE_EXEMPLO, 'SP');

    expect(linhas.map((linha) => linha.nome)).not.toContain('Brasiléia');
    const mococa = linhas.find((linha) => linha.nome === 'Mococa');
    expect(mococa?.hspAnual.toString()).toBe('5.283');
    expect(mococa?.hspMensal.map(String)).toEqual([
      '5.099', '5.569', '5.31', '5.47', '5', '4.881', '5.072', '5.76', '5.326', '5.407', '5.252', '5.251',
    ]);
  });

  it('recusa um CSV sem as colunas dos meses', async () => {
    await expect(lerCsvDoAtlas(CSV_SEM_MESES, 'SP')).rejects.toThrow(/faltam as colunas JAN/);
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
    const linhas = await lerCsvDoAtlas(CSV_DE_EXEMPLO, 'SP');
    const resultado = casarComMunicipios(linhas, MUNICIPIOS_SP, { 'Florínia': 3516101 });

    expect(resultado.irradiacoes.map((irradiacao) => irradiacao.codigoIbge).sort()).toEqual([3516101, 3530508, 3549706]);
    expect(resultado.linhasRecusadas).toEqual(['Pirassununga/SP: HSP mensal fora da faixa de 2,0 a 8,0']);
    expect(resultado.linhasSemMunicipio).toEqual(['Cidade Inexistente/SP']);
    expect(resultado.municipiosSemIrradiacao.map((municipio) => municipio.nome)).toEqual(['Pirassununga', 'Casa Branca']);
  });

  it('todo HSP gravado tem 12 meses entre 2,0 e 8,0', async () => {
    const { irradiacoes } = casarComMunicipios(await lerCsvDoAtlas(CSV_DE_EXEMPLO, 'SP'), MUNICIPIOS_SP);

    for (const { hspMensal } of irradiacoes) {
      expect(hspMensal).toHaveLength(12);
      expect(hspMensal.every((hsp) => hsp.gte(2) && hsp.lte(8))).toBe(true);
    }
  });

  it('sem a correção, o nome diferente fica sem município', async () => {
    const resultado = casarComMunicipios(await lerCsvDoAtlas(CSV_DE_EXEMPLO, 'SP'), MUNICIPIOS_SP, {});

    expect(resultado.linhasSemMunicipio).toContain('Florínia/SP');
    expect(resultado.municipiosSemIrradiacao.map((municipio) => municipio.nome)).toContain('Florínea');
  });
});

describe('carregarAtlas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grava só as irradiações que casaram com municípios da UF do parametros.json', async () => {
    vi.mocked(listarMunicipiosDaUf).mockResolvedValue(MUNICIPIOS_SP);

    const resultado = await carregarAtlas(CSV_DE_EXEMPLO);

    expect(listarMunicipiosDaUf).toHaveBeenCalledWith('SP');
    expect(salvarIrradiacoes).toHaveBeenCalledWith(resultado.irradiacoes);
    // A correção Florínia → Florínea vem do correcoes-atlas.json do projeto.
    expect(resultado.irradiacoes).toHaveLength(3);
  });

  it('pede para carregar os municípios antes, se a tabela estiver vazia', async () => {
    vi.mocked(listarMunicipiosDaUf).mockResolvedValue([]);

    await expect(carregarAtlas(CSV_DE_EXEMPLO)).rejects.toThrow(/npm run carregar-municipios/);
    expect(salvarIrradiacoes).not.toHaveBeenCalled();
  });
});
