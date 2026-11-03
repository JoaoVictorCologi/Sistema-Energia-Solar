// Carga da irradiação do Atlas Brasileiro de Energia Solar 2017 (LABREN/INPE), CSV de sedes municipais,
// plano inclinado igual à latitude. Colunas do CSV: ID;LON;LAT;NAME;CLASS;STATE;ANNUAL;JAN;…;DEC,
// em Wh/m² por dia. O ID é a célula da grade, não o código IBGE: o município casa por nome sem acento + UF.
// Carga nacional (Plano 5): todas as UFs de uma vez.
import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import correcoes from '../parametros/correcoes-atlas.json' with { type: 'json' };
import { salvarIrradiacoes, type IrradiacaoParaGravar } from '../repositories/irradiacaoRepository.ts';
import { listarTodosOsMunicipios, type MunicipioParaGravar } from '../repositories/municipiosRepository.ts';

const COLUNAS_DOS_MESES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const COLUNAS_OBRIGATORIAS = ['NAME', 'STATE', 'ANNUAL', ...COLUNAS_DOS_MESES];

// Faixa física do HSP mensal e tolerância da média dos meses contra o anual (docs/arquitetura/fontes-de-dados.md).
const HSP_MINIMO = new Decimal('2.0');
const HSP_MAXIMO = new Decimal('8.0');
const TOLERANCIA_DO_ANUAL = new Decimal('0.02');

const SIGLAS_DAS_UFS: Record<string, string> = {
  'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM', 'bahia': 'BA', 'ceara': 'CE',
  'distrito federal': 'DF', 'espirito santo': 'ES', 'goias': 'GO', 'maranhao': 'MA', 'mato grosso': 'MT',
  'mato grosso do sul': 'MS', 'minas gerais': 'MG', 'para': 'PA', 'paraiba': 'PB', 'parana': 'PR',
  'pernambuco': 'PE', 'piaui': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
  'rio grande do sul': 'RS', 'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
  'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO',
};

export interface LinhaDoAtlas {
  nome: string;
  uf: string;
  hspAnual: Decimal;
  hspMensal: Decimal[];
}

export interface ResultadoDoCasamento {
  irradiacoes: IrradiacaoParaGravar[];
  municipiosSemIrradiacao: MunicipioParaGravar[];
  linhasSemMunicipio: string[];
  linhasRecusadas: string[];
}

// Correções para o que não casa sozinho:
// - nomes: { UF do Atlas: { "nome no Atlas": código IBGE } }; o código pode ser de outra UF (o Atlas tem
//   Porto Alegre, capital do RS, com a UF do Rio Grande do Norte);
// - semSedeNoAtlas: { código IBGE: { usarSedeDe: código IBGE } }, para município que não está no Atlas.
const esquemaCorrecoes = z.object({
  nomes: z.record(z.string().regex(/^[A-Z]{2}$/), z.record(z.string(), z.number().int())),
  semSedeNoAtlas: z.record(z.string().regex(/^\d{7}$/), z.object({ usarSedeDe: z.number().int(), motivo: z.string() })),
});

export type CorrecoesDoAtlas = z.infer<typeof esquemaCorrecoes>;

const SEM_CORRECOES: CorrecoesDoAtlas = { nomes: {}, semSedeNoAtlas: {} };

// "São João d'Aliança" e "Sao Joao D Alianca" viram o mesmo texto.
export function normalizarNome(nome: string): string {
  return nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function siglaDaUf(nomeDoEstado: string): string {
  const sigla = SIGLAS_DAS_UFS[normalizarNome(nomeDoEstado)];
  if (!sigla) throw new Error(`UF desconhecida no Atlas: ${nomeDoEstado}`);
  return sigla;
}

function hspDe(valorEmWh: string, municipio: string): Decimal {
  if (!/^\d+(\.\d+)?$/.test(valorEmWh)) throw new Error(`Valor inválido no Atlas para ${municipio}: "${valorEmWh}"`);
  return new Decimal(valorEmWh).div(1000);
}

export function converterRegistro(registro: Record<string, string>): LinhaDoAtlas {
  return {
    nome: registro.NAME,
    uf: siglaDaUf(registro.STATE),
    hspAnual: hspDe(registro.ANNUAL, registro.NAME),
    hspMensal: COLUNAS_DOS_MESES.map((coluna) => hspDe(registro[coluna], registro.NAME)),
  };
}

// Devolve o motivo da recusa, ou null se a linha está dentro das faixas.
export function verificarIrradiacao({ hspAnual, hspMensal }: LinhaDoAtlas): string | null {
  if (hspMensal.some((hsp) => hsp.lt(HSP_MINIMO) || hsp.gt(HSP_MAXIMO))) return 'HSP mensal fora da faixa de 2,0 a 8,0';
  const media = Decimal.sum(...hspMensal).div(12);
  if (media.minus(hspAnual).abs().div(hspAnual).gt(TOLERANCIA_DO_ANUAL)) return 'média dos meses difere do anual em mais de 2%';
  return null;
}

function chaveDoNome(uf: string, nome: string): string {
  return `${uf}|${normalizarNome(nome)}`;
}

function acharCodigoIbge(linha: LinhaDoAtlas, porNome: Map<string, number>, correcoes: CorrecoesDoAtlas): number | undefined {
  return correcoes.nomes[linha.uf]?.[linha.nome] ?? porNome.get(chaveDoNome(linha.uf, linha.nome));
}

// Município que não está no Atlas recebe a irradiação da sede indicada na correção (se ela casou).
function aplicarSedesEmprestadas(resultado: ResultadoDoCasamento, codigos: Set<number>, casados: Set<number>, correcoes: CorrecoesDoAtlas): void {
  for (const [destino, { usarSedeDe }] of Object.entries(correcoes.semSedeNoAtlas)) {
    const origem = resultado.irradiacoes.find((irradiacao) => irradiacao.codigoIbge === usarSedeDe);
    if (!origem || !codigos.has(Number(destino)) || casados.has(Number(destino))) continue;
    casados.add(Number(destino));
    resultado.irradiacoes.push({ ...origem, codigoIbge: Number(destino) });
  }
}

// O nome só casa dentro da mesma UF ("Bom Jesus" existe em cinco estados).
export function casarComMunicipios(linhas: LinhaDoAtlas[], municipios: MunicipioParaGravar[], correcoes: CorrecoesDoAtlas = SEM_CORRECOES): ResultadoDoCasamento {
  const porNome = new Map(municipios.map((municipio) => [chaveDoNome(municipio.uf, municipio.nome), municipio.codigoIbge]));
  const codigos = new Set(municipios.map((municipio) => municipio.codigoIbge));
  const resultado: ResultadoDoCasamento = { irradiacoes: [], municipiosSemIrradiacao: [], linhasSemMunicipio: [], linhasRecusadas: [] };
  const casados = new Set<number>();

  for (const linha of linhas) {
    const codigoIbge = acharCodigoIbge(linha, porNome, correcoes);
    if (codigoIbge === undefined || !codigos.has(codigoIbge) || casados.has(codigoIbge)) {
      resultado.linhasSemMunicipio.push(`${linha.nome}/${linha.uf}`);
      continue;
    }
    const problema = verificarIrradiacao(linha);
    if (problema) {
      resultado.linhasRecusadas.push(`${linha.nome}/${linha.uf}: ${problema}`);
      continue;
    }
    casados.add(codigoIbge);
    resultado.irradiacoes.push({ codigoIbge, hspAnual: linha.hspAnual, hspMensal: linha.hspMensal });
  }
  aplicarSedesEmprestadas(resultado, codigos, casados, correcoes);
  resultado.municipiosSemIrradiacao = municipios.filter((municipio) => !casados.has(municipio.codigoIbge));
  return resultado;
}

function conferirColunas(colunas: string[]): string[] {
  const faltando = COLUNAS_OBRIGATORIAS.filter((coluna) => !colunas.includes(coluna));
  if (faltando.length) throw new Error(`O CSV não parece ser o de sedes municipais do Atlas: faltam as colunas ${faltando.join(', ')}.`);
  return colunas;
}

// Lê em streaming as 5.569 sedes do país.
export async function lerCsvDoAtlas(caminho: string): Promise<LinhaDoAtlas[]> {
  const leitor = createReadStream(caminho).pipe(parse({ delimiter: ';', columns: conferirColunas, bom: true, trim: true }));
  const linhas: LinhaDoAtlas[] = [];
  for await (const registro of leitor as AsyncIterable<Record<string, string>>) linhas.push(converterRegistro(registro));
  return linhas;
}

export async function carregarAtlas(caminhoDoCsv: string): Promise<ResultadoDoCasamento> {
  const municipios = await listarTodosOsMunicipios();
  if (municipios.length === 0) throw new Error('Nenhum município no banco. Rode antes: npm run carregar-municipios');
  const resultado = casarComMunicipios(await lerCsvDoAtlas(caminhoDoCsv), municipios, esquemaCorrecoes.parse(correcoes));
  await salvarIrradiacoes(resultado.irradiacoes);
  return resultado;
}
