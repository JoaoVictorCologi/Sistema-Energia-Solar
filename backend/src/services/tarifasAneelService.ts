// Importação diária da tarifa (TE e TUSD) e do Fio B da distribuidora padrão, a partir da ANEEL.
import { Decimal } from 'decimal.js';
import { buscarFioB, buscarRecursoDeComponentes, buscarRecursoDeTarifas, buscarTarifas, type FioBDaAneel, type TarifaDaAneel } from '../integracoes/aneel.ts';
import { ErroDeImportacao, type ContextoDaImportacao, type ResultadoDaImportacao } from '../jobs/tipos.ts';
import { parametros } from '../parametros/parametros.ts';
import { buscarVersaoDaUltimaImportacao } from '../repositories/importacoesRepository.ts';
import { gravarTarifas, listarTarifasDaDistribuidora, type DadosDaTarifa, type TarifaGravada } from '../repositories/tarifasRepository.ts';
import { hojeEmSaoPaulo } from '../utils/datas.ts';

export const TIPO_TARIFAS_ANEEL = 'aneel-tarifas';

const MODALIDADE = 'Convencional';
const CASAS_DECIMAIS = 6;
// Trava contra erro de unidade (MWh lido como kWh), não limite regulatório: TE + TUSD do B1 residencial.
const TARIFA_B1_MINIMA = new Decimal('0.40');
const TARIFA_B1_MAXIMA = new Decimal('1.50');

// A ANEEL publica em R$/MWh, com vírgula decimal e às vezes sem o zero (",00").
export function converterValorDaAneel(texto: string): Decimal {
  if (!/^\d*(,\d+)?$/.test(texto) || texto === '' || texto === ',') throw new ErroDeImportacao(`Valor inválido na ANEEL: "${texto}"`);
  return new Decimal(`0${texto.replace(',', '.')}`).div(1000).toDecimalPlaces(CASAS_DECIMAIS);
}

function chaveDaTarifa(tarifa: Pick<DadosDaTarifa, 'subgrupo' | 'modalidade' | 'classe' | 'subclasse' | 'inicioVigencia'>): string {
  return [tarifa.subgrupo, tarifa.modalidade, tarifa.classe, tarifa.subclasse, tarifa.inicioVigencia].join('|');
}

function conferirUnidade(unidade: string, esperada: string): void {
  if (unidade !== esperada) throw new ErroDeImportacao(`Unidade inesperada na ANEEL: "${unidade}" (esperado "${esperada}")`);
}

// Junta tarifa e Fio B da mesma vigência. Linhas repetidas na ANEEL: vale a publicada por último (maior _id).
export function montarTarifas(tarifasDaAneel: TarifaDaAneel[], fioBDaAneel: FioBDaAneel[]): DadosDaTarifa[] {
  const fioBPorChave = new Map<string, Decimal>();
  for (const componente of [...fioBDaAneel].sort((a, b) => a._id - b._id)) {
    conferirUnidade(componente.DscUnidade, 'R$/MWh');
    fioBPorChave.set(chaveDaTarifa({
      subgrupo: componente.DscSubGrupoTarifario, modalidade: MODALIDADE, classe: componente.DscClasseConsumidor,
      subclasse: componente.DscSubClasseConsumidor, inicioVigencia: componente.DatInicioVigencia,
    }), converterValorDaAneel(componente.VlrComponenteTarifario));
  }

  const tarifasPorChave = new Map<string, DadosDaTarifa>();
  for (const linha of [...tarifasDaAneel].sort((a, b) => a._id - b._id)) {
    conferirUnidade(linha.DscUnidadeTerciaria, 'MWh');
    const tarifa: DadosDaTarifa = {
      subgrupo: linha.DscSubGrupo, modalidade: MODALIDADE, classe: linha.DscClasse, subclasse: linha.DscSubClasse,
      te: converterValorDaAneel(linha.VlrTE), tusd: converterValorDaAneel(linha.VlrTUSD), fioB: null,
      inicioVigencia: linha.DatInicioVigencia, fimVigencia: linha.DatFimVigencia || null,
    };
    tarifa.fioB = fioBPorChave.get(chaveDaTarifa(tarifa)) ?? null;
    tarifasPorChave.set(chaveDaTarifa(tarifa), tarifa);
  }
  return [...tarifasPorChave.values()];
}

function problemaDaTarifa(tarifa: DadosDaTarifa): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarifa.inicioVigencia)) return 'início de vigência inválido';
  if (tarifa.fimVigencia && tarifa.fimVigencia <= tarifa.inicioVigencia) return 'fim da vigência antes do início';
  if (tarifa.tusd.lte(0)) return 'TUSD precisa ser positiva';
  if (tarifa.fioB && (tarifa.fioB.lte(0) || tarifa.fioB.gte(tarifa.tusd))) return 'Fio B precisa ser maior que zero e menor que a TUSD';
  const total = tarifa.te.plus(tarifa.tusd);
  if (tarifa.subgrupo === 'B1' && tarifa.subclasse === 'Residencial' && (total.lt(TARIFA_B1_MINIMA) || total.gt(TARIFA_B1_MAXIMA))) {
    return `TE + TUSD de ${total.toString()} fora da faixa de 0,40 a 1,50 por kWh`;
  }
  return null;
}

// Uma linha fora do esperado recusa a importação inteira: o sistema segue com as tarifas anteriores.
export function validarTarifas(tarifas: DadosDaTarifa[]): void {
  const problemas = tarifas.flatMap((tarifa) => {
    const problema = problemaDaTarifa(tarifa);
    return problema ? [`${tarifa.subgrupo} ${tarifa.subclasse} (${tarifa.inicioVigencia}): ${problema}`] : [];
  });
  if (problemas.length > 0) throw new ErroDeImportacao(`Tarifas recusadas: ${problemas.slice(0, 3).join('; ')}`);
}

function mudou(gravada: TarifaGravada, recebida: DadosDaTarifa): boolean {
  return !gravada.te.eq(recebida.te) || !gravada.tusd.eq(recebida.tusd) || gravada.fimVigencia !== recebida.fimVigencia
    || (recebida.fioB !== null && (gravada.fioB === null || !gravada.fioB.eq(recebida.fioB)));
}

// Vigência nova vira linha nova; a antiga nunca é apagada. O Fio B só vem do recurso do ano corrente:
// sem ele na resposta, o já gravado é mantido.
export function separarNovasEAlteradas(gravadas: TarifaGravada[], recebidas: DadosDaTarifa[]): { novas: DadosDaTarifa[]; alteradas: TarifaGravada[] } {
  const gravadasPorChave = new Map(gravadas.map((tarifa) => [chaveDaTarifa(tarifa), tarifa]));
  const novas: DadosDaTarifa[] = [];
  const alteradas: TarifaGravada[] = [];
  for (const recebida of recebidas) {
    const gravada = gravadasPorChave.get(chaveDaTarifa(recebida));
    if (!gravada) novas.push(recebida);
    else if (mudou(gravada, recebida)) alteradas.push({ ...recebida, id: gravada.id, fioB: recebida.fioB ?? gravada.fioB });
  }
  return { novas, alteradas };
}

// CNPJ da vigência mais recente: depois de uma incorporação, a sigla pode ter tido outro CNPJ no passado.
function cnpjAtual(tarifas: TarifaDaAneel[]): string {
  return tarifas.reduce((maisRecente, tarifa) => (tarifa.DatInicioVigencia > maisRecente.DatInicioVigencia ? tarifa : maisRecente)).NumCNPJDistribuidora;
}

export async function importarTarifasDaAneel({ importacaoId, agora }: ContextoDaImportacao): Promise<ResultadoDaImportacao> {
  const sigla = parametros.distribuidoraPadrao;
  const recursoDeTarifas = await buscarRecursoDeTarifas();
  const recursoDeComponentes = await buscarRecursoDeComponentes(Number(hojeEmSaoPaulo(agora).slice(0, 4)));
  const versaoDaFonte = `${sigla} | tarifas ${recursoDeTarifas.modificadoEm} | componentes ${recursoDeComponentes.ano} ${recursoDeComponentes.modificadoEm}`;
  if (versaoDaFonte === await buscarVersaoDaUltimaImportacao(TIPO_TARIFAS_ANEEL)) return { status: 'sem_alteracao', linhasGravadas: 0, versaoDaFonte };

  const tarifasDaAneel = await buscarTarifas(recursoDeTarifas.id, sigla);
  if (tarifasDaAneel.length === 0) throw new ErroDeImportacao(`A ANEEL não tem tarifas B1, B2 ou B3 para "${sigla}". Confira distribuidoraPadrao no parametros.json.`);
  const cnpj = cnpjAtual(tarifasDaAneel);
  const recebidas = montarTarifas(tarifasDaAneel, await buscarFioB(recursoDeComponentes.id, cnpj));
  validarTarifas(recebidas);

  const { novas, alteradas } = separarNovasEAlteradas(await listarTarifasDaDistribuidora(sigla), recebidas);
  await gravarTarifas({ distribuidora: { sigla, cnpj }, novas, alteradas, importacaoId });
  return { status: 'sucesso', linhasGravadas: novas.length + alteradas.length, versaoDaFonte };
}
