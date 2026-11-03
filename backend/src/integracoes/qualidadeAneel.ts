// Vínculo município → distribuidora pelas bases de qualidade do serviço da ANEEL (DataStore ativo, com distinct).
// A base de usinas (MMGD) teria a mesma informação, mas só existe como ZIP ou Parquet completos.
import { z } from 'zod';
import { buscarRecursosDoPacote, percorrerDatastore, type RecursoDoCkan } from './ckan.ts';
import { ErroDeIntegracao } from './http.ts';

const CONJUNTO_DOS_MUNICIPIOS = { pacote: 'indqual-municipio', recurso: 'indqual-municipio' };
const CONJUNTO_DOS_LIMITES = { pacote: 'indicadores-coletivos-de-continuidade-dec-e-fec', recurso: 'indicadores-continuidade-coletivos-limite' };
// Cerca de 43 mil pares município × conjunto: páginas grandes para não passar do limite de páginas.
const TAMANHO_DA_PAGINA = 5_000;

// Na base de limites, CNPJ e conjunto chegam como número; na de municípios, como texto.
const codigo = z.union([z.string(), z.number()]).transform(String);
const esquemaConjunto = z.object({ SigAgente: z.string(), NumCNPJ: codigo.transform((cnpj) => cnpj.padStart(14, '0')), IdeConjUndConsumidoras: codigo });
const esquemaMunicipio = z.object({ CodMunicipio: codigo, IdeConjUnidConsumidoras: codigo });

export interface ConjuntoDaDistribuidora {
  conjunto: string;
  cnpj: string;
  sigla: string;
}

export interface ConjuntoDoMunicipio {
  codigoIbge: number;
  conjunto: string;
}

async function acharRecurso({ pacote, recurso }: { pacote: string; recurso: string }): Promise<RecursoDoCkan> {
  const encontrado = (await buscarRecursosDoPacote(pacote)).find((item) => item.nome === recurso && item.datastoreAtivo);
  if (!encontrado) throw new ErroDeIntegracao(`A ANEEL não tem mais o recurso ${recurso} com DataStore ativo.`);
  return encontrado;
}

export const buscarRecursoDosMunicipios = () => acharRecurso(CONJUNTO_DOS_MUNICIPIOS);
export const buscarRecursoDosLimites = () => acharRecurso(CONJUNTO_DOS_LIMITES);

function lerLinhas<T>(esquema: z.ZodType<T>, registros: Record<string, unknown>[], destino: T[]): void {
  for (const registro of registros) {
    const linha = esquema.safeParse(registro);
    if (!linha.success) throw new ErroDeIntegracao('A ANEEL devolveu uma linha de qualidade num formato inesperado (colunas mudaram?).');
    destino.push(linha.data);
  }
}

// Conjuntos que têm limite de qualidade no ano: são os conjuntos atuais de cada distribuidora.
export async function buscarConjuntosDoAno(recursoId: string, ano: number): Promise<ConjuntoDaDistribuidora[]> {
  const linhas: z.infer<typeof esquemaConjunto>[] = [];
  await percorrerDatastore({
    recursoId, filtros: { AnoLimiteQualidade: ano }, campos: ['SigAgente', 'NumCNPJ', 'IdeConjUndConsumidoras'], distinct: true, tamanhoDaPagina: TAMANHO_DA_PAGINA,
  }, (registros) => lerLinhas(esquemaConjunto, registros, linhas));
  return linhas.map((linha) => ({ conjunto: linha.IdeConjUndConsumidoras, cnpj: linha.NumCNPJ, sigla: linha.SigAgente }));
}

// Inclui conjuntos antigos, que já não existem: quem usa ignora os que não estão nos conjuntos do ano.
export async function buscarConjuntosDosMunicipios(recursoId: string): Promise<ConjuntoDoMunicipio[]> {
  const linhas: z.infer<typeof esquemaMunicipio>[] = [];
  await percorrerDatastore({
    recursoId, filtros: {}, campos: ['CodMunicipio', 'IdeConjUnidConsumidoras'], distinct: true, tamanhoDaPagina: TAMANHO_DA_PAGINA,
  }, (registros) => lerLinhas(esquemaMunicipio, registros, linhas));
  return linhas.map((linha) => ({ codigoIbge: Number(linha.CodMunicipio), conjunto: linha.IdeConjUnidConsumidoras }));
}
