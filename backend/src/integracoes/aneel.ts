// Consultas aos conjuntos de tarifas da ANEEL: só B1, B2 e B3 convencional, só a Tarifa de Aplicação (a usada no
// faturamento) e só as colunas usadas, de todas as distribuidoras numa consulta (cerca de 27 mil das 650 mil linhas).
import { z } from 'zod';
import { buscarRecursosDoPacote, percorrerDatastore, type RecursoDoCkan } from './ckan.ts';
import { ErroDeIntegracao } from './http.ts';

const CONJUNTO_DE_TARIFAS = 'tarifas-distribuidoras-energia-eletrica';
const RECURSO_DE_TARIFAS = 'tarifas-homologadas-distribuidoras-energia-eletrica.csv';
const CONJUNTO_DE_COMPONENTES = 'componentes-tarifarias';

const SUBGRUPOS = ['B1', 'B2', 'B3'];
const CLASSES = ['Residencial', 'Rural', 'Não se aplica'];
const SUBCLASSES = ['Residencial', 'Não se aplica'];
const NAO_SE_APLICA = 'Não se aplica';

// Valores e datas chegam como texto; a conversão (vírgula decimal, MWh para kWh) fica no service.
const esquemaTarifa = z.object({
  _id: z.number(),
  SigAgente: z.string(),
  NumCNPJDistribuidora: z.string(),
  DatInicioVigencia: z.string(),
  DatFimVigencia: z.string().nullable(),
  DscSubGrupo: z.string(),
  DscClasse: z.string(),
  DscSubClasse: z.string(),
  DscUnidadeTerciaria: z.string(),
  VlrTUSD: z.string(),
  VlrTE: z.string(),
});

const esquemaFioB = z.object({
  _id: z.number(),
  NumCPFCNPJ: z.string(),
  DatInicioVigencia: z.string(),
  DscSubGrupoTarifario: z.string(),
  DscClasseConsumidor: z.string(),
  DscSubClasseConsumidor: z.string(),
  DscUnidade: z.string(),
  VlrComponenteTarifario: z.string(),
});

export type TarifaDaAneel = z.infer<typeof esquemaTarifa>;
export type FioBDaAneel = z.infer<typeof esquemaFioB>;

// Procura pelo nome, para não depender de um id fixo na fonte.
async function acharRecurso(conjunto: string, nome: string): Promise<RecursoDoCkan | undefined> {
  const recursos = await buscarRecursosDoPacote(conjunto);
  return recursos.find((recurso) => recurso.nome === nome && recurso.datastoreAtivo);
}

export async function buscarRecursoDeTarifas(): Promise<RecursoDoCkan> {
  const recurso = await acharRecurso(CONJUNTO_DE_TARIFAS, RECURSO_DE_TARIFAS);
  if (!recurso) throw new ErroDeIntegracao(`A ANEEL não tem mais o recurso ${RECURSO_DE_TARIFAS} com DataStore ativo.`);
  return recurso;
}

// Um CSV por ano, e o Fio B de uma vigência está no arquivo do ano em que ela começou. A ANEEL não publica o
// componente de todas as distribuidoras todo ano (em 11/2026, 22 só tinham Fio B até 2023): por isso os últimos 4 anos.
const ANOS_DE_COMPONENTES = 4;

export async function buscarRecursosDeComponentes(ano: number): Promise<(RecursoDoCkan & { ano: number })[]> {
  const recursos = await buscarRecursosDoPacote(CONJUNTO_DE_COMPONENTES);
  const anos = Array.from({ length: ANOS_DE_COMPONENTES }, (_, recuo) => ano - recuo);
  const encontrados = anos.flatMap((anoProcurado) => {
    const recurso = recursos.find((item) => item.nome === `componentes-tarifarias-${anoProcurado}.csv` && item.datastoreAtivo);
    return recurso ? [{ ...recurso, ano: anoProcurado }] : [];
  });
  if (encontrados.length === 0) throw new ErroDeIntegracao(`A ANEEL não tem componentes tarifários de ${anos.at(-1)} a ${ano} com DataStore ativo.`);
  return encontrados;
}

function lerRegistros<T>(esquema: z.ZodType<T>, registros: Record<string, unknown>[], destino: T[]): void {
  for (const registro of registros) {
    const resultado = esquema.safeParse(registro);
    if (!resultado.success) throw new ErroDeIntegracao('A ANEEL devolveu uma linha num formato inesperado (colunas mudaram?).');
    destino.push(resultado.data);
  }
}

// Páginas de 5.000: as tarifas B1–B3 de todas as distribuidoras e vigências cabem em cerca de 6.
const TAMANHO_DA_PAGINA = 5_000;

export async function buscarTarifas(recursoId: string): Promise<TarifaDaAneel[]> {
  const tarifas: TarifaDaAneel[] = [];
  await percorrerDatastore({
    recursoId,
    tamanhoDaPagina: TAMANHO_DA_PAGINA,
    filtros: {
      DscBaseTarifaria: 'Tarifa de Aplicação',
      DscSubGrupo: SUBGRUPOS,
      // Só a tarifa cheia, a que a simulação usa: B1 residencial, B2 rural e B3 (sem tarifa social nem cooperativas).
      DscClasse: CLASSES,
      DscSubClasse: SUBCLASSES,
      DscModalidadeTarifaria: 'Convencional',
      // SCEE é a variante do sistema de compensação; fica de fora, como os postos e os acessantes.
      DscDetalhe: NAO_SE_APLICA,
      NomPostoTarifario: NAO_SE_APLICA,
      SigAgenteAcessante: NAO_SE_APLICA,
    },
    campos: Object.keys(esquemaTarifa.shape),
  }, (registros) => lerRegistros(esquemaTarifa, registros, tarifas));
  return tarifas;
}

// Componentes usam o CNPJ da distribuidora, não a sigla.
export async function buscarFioB(recursoId: string): Promise<FioBDaAneel[]> {
  const componentes: FioBDaAneel[] = [];
  await percorrerDatastore({
    recursoId,
    tamanhoDaPagina: TAMANHO_DA_PAGINA,
    filtros: {
      DscComponenteTarifario: 'TUSD_FioB',
      DscBaseTarifaria: 'Tarifa de Aplicação',
      DscSubGrupoTarifario: SUBGRUPOS,
      DscClasseConsumidor: CLASSES,
      DscSubClasseConsumidor: SUBCLASSES,
      DscModalidadeTarifaria: 'Convencional',
      DscDetalheConsumidor: NAO_SE_APLICA,
      DscPostoTarifario: NAO_SE_APLICA,
    },
    campos: Object.keys(esquemaFioB.shape),
  }, (registros) => lerRegistros(esquemaFioB, registros, componentes));
  return componentes;
}
