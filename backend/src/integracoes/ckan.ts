// Cliente do CKAN (Dados Abertos da ANEEL): metadados dos conjuntos e leitura do DataStore.
// Sempre com filtros, colunas e páginas; nunca baixa o arquivo completo de um recurso.
import { z } from 'zod';
import { buscarJson, ErroDeIntegracao } from './http.ts';

const URL_DO_CKAN_DA_ANEEL = 'https://dadosabertos.aneel.gov.br/api/3/action';

// Os arquivos da ANEEL são grandes: cada página tem mais tempo que o padrão.
const TIMEOUT_MS = 60_000;

export interface RecursoDoCkan {
  id: string;
  nome: string;
  formato: string;
  datastoreAtivo: boolean;
  modificadoEm: string;
}

export interface ConsultaAoDatastore {
  recursoId: string;
  // Campos diferentes combinam com E; uma lista no mesmo campo combina com OU.
  filtros: Record<string, string | string[]>;
  campos: string[];
  distinct?: boolean;
  tamanhoDaPagina?: number;
  limiteDePaginas?: number;
}

const esquemaPacote = z.object({
  success: z.literal(true),
  result: z.object({
    resources: z.array(z.object({
      id: z.string(),
      name: z.string(),
      format: z.string().nullable(),
      datastore_active: z.boolean().nullish(),
      last_modified: z.string().nullable(),
    })),
  }),
});

const esquemaPagina = z.object({
  success: z.literal(true),
  result: z.object({ records: z.array(z.record(z.string(), z.unknown())) }),
});

export async function buscarRecursosDoPacote(pacote: string): Promise<RecursoDoCkan[]> {
  const resposta = esquemaPacote.safeParse(await buscarJson(`${URL_DO_CKAN_DA_ANEEL}/package_show?id=${encodeURIComponent(pacote)}`, { timeoutMs: TIMEOUT_MS }));
  if (!resposta.success) throw new ErroDeIntegracao(`O CKAN devolveu o conjunto ${pacote} num formato inesperado.`);
  return resposta.data.result.resources.map((recurso) => ({
    id: recurso.id,
    nome: recurso.name,
    formato: recurso.format ?? '',
    datastoreAtivo: recurso.datastore_active === true,
    modificadoEm: recurso.last_modified ?? '',
  }));
}

function montarCorpo(consulta: ConsultaAoDatastore, tamanhoDaPagina: number, pagina: number) {
  return {
    resource_id: consulta.recursoId,
    filters: consulta.filtros,
    fields: consulta.campos,
    // Com distinct, ordenar por _id desfaria o agrupamento; sem ele, _id deixa a paginação estável.
    sort: consulta.distinct ? consulta.campos.join(', ') : '_id asc',
    ...(consulta.distinct ? { distinct: true } : {}),
    limit: tamanhoDaPagina,
    offset: pagina * tamanhoDaPagina,
  };
}

// Lê as páginas uma a uma e entrega cada uma a `processarPagina`, sem juntar tudo na memória.
// Passar do limite de páginas é erro: o filtro está largo demais e o resultado viria incompleto.
export async function percorrerDatastore(
  consulta: ConsultaAoDatastore,
  processarPagina: (registros: Record<string, unknown>[]) => void | Promise<void>,
): Promise<void> {
  const tamanhoDaPagina = consulta.tamanhoDaPagina ?? 1_000;
  const limiteDePaginas = consulta.limiteDePaginas ?? 20;

  for (let pagina = 0; pagina < limiteDePaginas; pagina++) {
    const corpo = montarCorpo(consulta, tamanhoDaPagina, pagina);
    const resposta = esquemaPagina.safeParse(await buscarJson(`${URL_DO_CKAN_DA_ANEEL}/datastore_search`, { metodo: 'POST', corpo, timeoutMs: TIMEOUT_MS }));
    if (!resposta.success) throw new ErroDeIntegracao('O DataStore da ANEEL devolveu uma página num formato inesperado.');
    const { records } = resposta.data.result;
    await processarPagina(records);
    if (records.length < tamanhoDaPagina) return;
  }
  throw new ErroDeIntegracao(`A consulta passou de ${limiteDePaginas} páginas de ${tamanhoDaPagina} linhas; confira os filtros.`);
}
