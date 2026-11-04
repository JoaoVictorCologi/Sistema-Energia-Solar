// Importação semanal do vínculo município → distribuidora.
import {
  buscarConjuntosDoAno, buscarConjuntosDosMunicipios, buscarRecursoDosLimites, buscarRecursoDosMunicipios,
  type ConjuntoDaDistribuidora, type ConjuntoDoMunicipio,
} from '../integracoes/qualidadeAneel.ts';
import { ErroDeImportacao, type ContextoDaImportacao, type ResultadoDaImportacao } from '../jobs/tipos.ts';
import { substituirVinculos, type VinculoParaGravar } from '../repositories/distribuidorasRepository.ts';
import { buscarVersaoDaUltimaImportacao } from '../repositories/importacoesRepository.ts';
import { listarTodosOsMunicipios } from '../repositories/municipiosRepository.ts';
import { hojeEmSaoPaulo } from '../utils/datas.ts';

export const TIPO_DISTRIBUIDORAS_ANEEL = 'aneel-distribuidoras';

// Trava contra resposta incompleta da ANEEL: menos que isso do país ligado, a importação é recusada.
const COBERTURA_MINIMA = 0.9;

function ordenarPorConjuntos(contagem: Map<string, number>): [string, number][] {
  return [...contagem].sort(([cnpjA, a], [cnpjB, b]) => b - a || cnpjA.localeCompare(cnpjB));
}

// Para cada município, conta os conjuntos atuais de cada distribuidora (conjunto antigo, sem limite no ano, não conta).
// A de mais conjuntos é a sugerida; em empate, a de menor CNPJ, para o resultado não depender da ordem da API.
export function montarVinculos(conjuntosDoAno: ConjuntoDaDistribuidora[], conjuntosDosMunicipios: ConjuntoDoMunicipio[], codigosValidos: Set<number>): VinculoParaGravar[] {
  const distribuidoraDoConjunto = new Map(conjuntosDoAno.map((conjunto) => [conjunto.conjunto, conjunto]));
  const contagem = new Map<number, Map<string, number>>();
  for (const { codigoIbge, conjunto } of conjuntosDosMunicipios) {
    const distribuidora = distribuidoraDoConjunto.get(conjunto);
    if (!distribuidora || !codigosValidos.has(codigoIbge)) continue;
    const doMunicipio = contagem.get(codigoIbge) ?? new Map<string, number>();
    doMunicipio.set(distribuidora.cnpj, (doMunicipio.get(distribuidora.cnpj) ?? 0) + 1);
    contagem.set(codigoIbge, doMunicipio);
  }
  const siglaDoCnpj = new Map(conjuntosDoAno.map((conjunto) => [conjunto.cnpj, conjunto.sigla]));
  return [...contagem].flatMap(([codigoIbge, porCnpj]) => ordenarPorConjuntos(porCnpj).map(([cnpj, conjuntos], posicao) => ({
    codigoIbge, cnpj, sigla: siglaDoCnpj.get(cnpj)!, conjuntos, sugerida: posicao === 0,
  })));
}

// A versão da fonte evita baixar as bases quando nada mudou.
export async function importarDistribuidorasDosMunicipios({ importacaoId, agora }: ContextoDaImportacao): Promise<ResultadoDaImportacao> {
  const ano = Number(hojeEmSaoPaulo(agora).slice(0, 4));
  const [limites, municipiosDaQualidade] = await Promise.all([buscarRecursoDosLimites(), buscarRecursoDosMunicipios()]);
  const versaoDaFonte = `limites ${ano} ${limites.modificadoEm} | municípios ${municipiosDaQualidade.modificadoEm}`;
  if (versaoDaFonte === await buscarVersaoDaUltimaImportacao(TIPO_DISTRIBUIDORAS_ANEEL)) return { status: 'sem_alteracao', linhasGravadas: 0, versaoDaFonte };

  const [conjuntosDoAno, conjuntosDosMunicipios, municipios] = await Promise.all([
    buscarConjuntosDoAno(limites.id, ano), buscarConjuntosDosMunicipios(municipiosDaQualidade.id), listarTodosOsMunicipios(),
  ]);
  const vinculos = montarVinculos(conjuntosDoAno, conjuntosDosMunicipios, new Set(municipios.map((municipio) => municipio.codigoIbge)));
  const ligados = new Set(vinculos.map((vinculo) => vinculo.codigoIbge)).size;
  if (ligados < municipios.length * COBERTURA_MINIMA) {
    throw new ErroDeImportacao(`Só ${ligados} de ${municipios.length} municípios ficariam com distribuidora; vínculos anteriores mantidos.`);
  }
  await substituirVinculos(vinculos, importacaoId);
  return { status: 'sucesso', linhasGravadas: vinculos.length, versaoDaFonte };
}
