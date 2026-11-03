// Consultas aos conjuntos de tarifas da ANEEL. Só a distribuidora pedida, só B1, B2 e B3 convencional,
// só a Tarifa de Aplicação (a usada no faturamento) e só as colunas usadas.
import { z } from 'zod';
import { buscarRecursosDoPacote, percorrerDatastore, type RecursoDoCkan } from './ckan.ts';
import { ErroDeIntegracao } from './http.ts';

const CONJUNTO_DE_TARIFAS = 'tarifas-distribuidoras-energia-eletrica';
const RECURSO_DE_TARIFAS = 'tarifas-homologadas-distribuidoras-energia-eletrica.csv';
const CONJUNTO_DE_COMPONENTES = 'componentes-tarifarias';

const SUBGRUPOS = ['B1', 'B2', 'B3'];
const NAO_SE_APLICA = 'Não se aplica';

// Valores e datas chegam como texto; a conversão (vírgula decimal, MWh para kWh) fica no service.
const esquemaTarifa = z.object({
  _id: z.number(),
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
  DatInicioVigencia: z.string(),
  DscSubGrupoTarifario: z.string(),
  DscClasseConsumidor: z.string(),
  DscSubClasseConsumidor: z.string(),
  DscUnidade: z.string(),
  VlrComponenteTarifario: z.string(),
});

export type TarifaDaAneel = z.infer<typeof esquemaTarifa>;
export type FioBDaAneel = z.infer<typeof esquemaFioB>;

async function acharRecurso(conjunto: string, nome: string): Promise<RecursoDoCkan | undefined> {
  const recursos = await buscarRecursosDoPacote(conjunto);
  return recursos.find((recurso) => recurso.nome === nome && recurso.datastoreAtivo);
}

export async function buscarRecursoDeTarifas(): Promise<RecursoDoCkan> {
  const recurso = await acharRecurso(CONJUNTO_DE_TARIFAS, RECURSO_DE_TARIFAS);
  if (!recurso) throw new ErroDeIntegracao(`A ANEEL não tem mais o recurso ${RECURSO_DE_TARIFAS} com DataStore ativo.`);
  return recurso;
}

// Um CSV por ano; no começo do ano o novo pode ainda não existir, então vale o do ano anterior.
export async function buscarRecursoDeComponentes(ano: number): Promise<RecursoDoCkan & { ano: number }> {
  const recursos = await buscarRecursosDoPacote(CONJUNTO_DE_COMPONENTES);
  for (const anoProcurado of [ano, ano - 1]) {
    const recurso = recursos.find((item) => item.nome === `componentes-tarifarias-${anoProcurado}.csv` && item.datastoreAtivo);
    if (recurso) return { ...recurso, ano: anoProcurado };
  }
  throw new ErroDeIntegracao(`A ANEEL não tem componentes tarifários de ${ano} nem de ${ano - 1} com DataStore ativo.`);
}

function lerRegistros<T>(esquema: z.ZodType<T>, registros: Record<string, unknown>[], destino: T[]): void {
  for (const registro of registros) {
    const resultado = esquema.safeParse(registro);
    if (!resultado.success) throw new ErroDeIntegracao('A ANEEL devolveu uma linha num formato inesperado (colunas mudaram?).');
    destino.push(resultado.data);
  }
}

export async function buscarTarifas(recursoId: string, sigla: string): Promise<TarifaDaAneel[]> {
  const tarifas: TarifaDaAneel[] = [];
  await percorrerDatastore({
    recursoId,
    filtros: {
      SigAgente: sigla,
      DscBaseTarifaria: 'Tarifa de Aplicação',
      DscSubGrupo: SUBGRUPOS,
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
export async function buscarFioB(recursoId: string, cnpj: string): Promise<FioBDaAneel[]> {
  const componentes: FioBDaAneel[] = [];
  await percorrerDatastore({
    recursoId,
    filtros: {
      NumCPFCNPJ: cnpj,
      DscComponenteTarifario: 'TUSD_FioB',
      DscBaseTarifaria: 'Tarifa de Aplicação',
      DscSubGrupoTarifario: SUBGRUPOS,
      DscModalidadeTarifaria: 'Convencional',
      DscDetalheConsumidor: NAO_SE_APLICA,
      DscPostoTarifario: NAO_SE_APLICA,
    },
    campos: Object.keys(esquemaFioB.shape),
  }, (registros) => lerRegistros(esquemaFioB, registros, componentes));
  return componentes;
}
