// Importação diária das séries do Banco Central usadas como premissas financeiras.
import { Decimal } from 'decimal.js';
import { buscarSerie } from '../integracoes/bancoCentral.ts';
import { ErroDeImportacao, type ContextoDaImportacao, type ResultadoDaImportacao } from '../jobs/tipos.ts';
import { buscarUltimaDataDaSerie, gravarIndicadores, type IndicadorParaGravar } from '../repositories/indicadoresRepository.ts';
import { hojeEmSaoPaulo, somarAnos, somarDias } from '../utils/datas.ts';

export const TIPO_INDICADORES_BCB = 'bcb-indicadores';

// Faixas plausíveis, em %: travam erro de unidade ou de série trocada.
export const SERIES = [
  { codigo: 433, nome: 'IPCA mensal', minimo: '-2', maximo: '3' },
  { codigo: 13522, nome: 'IPCA em 12 meses', minimo: '-5', maximo: '30' },
  { codigo: 432, nome: 'Selic meta', minimo: '0', maximo: '50' },
];

// Primeira carga: 2 anos de histórico, bem abaixo do limite de 10 anos das séries diárias.
const ANOS_DE_HISTORICO = 2;

export function converterValores(serie: (typeof SERIES)[number], valores: { data: string; valor: string }[]): IndicadorParaGravar[] {
  return valores.map(({ data, valor }) => {
    if (!/^-?\d+(\.\d+)?$/.test(valor)) throw new ErroDeImportacao(`${serie.nome}: valor inválido "${valor}" em ${data}`);
    const numero = new Decimal(valor);
    if (numero.lt(serie.minimo) || numero.gt(serie.maximo)) {
      throw new ErroDeImportacao(`${serie.nome}: ${valor}% em ${data} fora da faixa de ${serie.minimo}% a ${serie.maximo}%`);
    }
    return { serie: serie.codigo, data, valor: numero };
  });
}

async function buscarNovidadesDaSerie(serie: (typeof SERIES)[number], hoje: string): Promise<IndicadorParaGravar[]> {
  const ultimaData = await buscarUltimaDataDaSerie(serie.codigo);
  const dataInicial = ultimaData ? somarDias(ultimaData, 1) : somarAnos(hoje, -ANOS_DE_HISTORICO);
  // A Selic meta já traz o dia seguinte; quando a última data passou de hoje, não há o que buscar.
  if (dataInicial > hoje) return [];
  // Sem valor novo no período, o SGS pode devolver de novo o último valor de uma série mensal.
  const valores = await buscarSerie(serie.codigo, dataInicial, hoje);
  return converterValores(serie, valores.filter(({ data }) => data >= dataInicial));
}

// Busca todas as séries antes de gravar: falha em qualquer uma não grava nada.
export async function importarIndicadores({ importacaoId, agora }: ContextoDaImportacao): Promise<ResultadoDaImportacao> {
  const hoje = hojeEmSaoPaulo(agora);
  const novidades: IndicadorParaGravar[] = [];
  for (const serie of SERIES) novidades.push(...await buscarNovidadesDaSerie(serie, hoje));
  const linhasGravadas = await gravarIndicadores(novidades, importacaoId);
  return { status: linhasGravadas > 0 ? 'sucesso' : 'sem_alteracao', linhasGravadas };
}
