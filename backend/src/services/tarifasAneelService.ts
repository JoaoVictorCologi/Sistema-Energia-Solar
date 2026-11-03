// Importação diária da tarifa (TE e TUSD) e do Fio B de todas as distribuidoras ligadas a municípios (Plano 5).
import { Decimal } from 'decimal.js';
import { createHash } from 'node:crypto';
import { buscarFioB, buscarRecursoDeTarifas, buscarRecursosDeComponentes, buscarTarifas, type FioBDaAneel, type TarifaDaAneel } from '../integracoes/aneel.ts';
import { ErroDeImportacao, type ContextoDaImportacao, type ResultadoDaImportacao } from '../jobs/tipos.ts';
import { listarCnpjsLigados } from '../repositories/distribuidorasRepository.ts';
import { buscarVersaoDaUltimaImportacao } from '../repositories/importacoesRepository.ts';
import { gravarTarifas, listarTarifasPorCnpj, type DadosDaTarifa, type GravacaoDaDistribuidora, type TarifaGravada } from '../repositories/tarifasRepository.ts';
import { hojeEmSaoPaulo } from '../utils/datas.ts';

export const TIPO_TARIFAS_ANEEL = 'aneel-tarifas';

const MODALIDADE = 'Convencional';
const CASAS_DECIMAIS = 6;
// Trava contra erro de unidade (MWh lido como kWh, mil vezes maior ou menor), não limite regulatório:
// TE + TUSD da tarifa cheia (a única importada). Larga o bastante para as vigências desde 2010 (cerca de R$ 0,31 por kWh).
const TARIFA_MINIMA = new Decimal('0.10');
const TARIFA_MAXIMA = new Decimal('2.00');

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

// Valor ilegível numa linha é descartado e listado (a ANEEL tem, por exemplo, Fio B "-2,0999999999999999E-8").
function converterOuDescartar(texto: string, descricao: string, descartadas: string[]): Decimal | null {
  try {
    return converterValorDaAneel(texto);
  } catch (erro) {
    if (!(erro instanceof ErroDeImportacao)) throw erro;
    descartadas.push(`${descricao}: valor inválido "${texto}"`);
    return null;
  }
}

function lerFioB(fioBDaAneel: FioBDaAneel[], descartadas: string[]): Map<string, Decimal> {
  const fioBPorChave = new Map<string, Decimal>();
  for (const componente of [...fioBDaAneel].sort((a, b) => a._id - b._id)) {
    conferirUnidade(componente.DscUnidade, 'R$/MWh');
    const valor = converterOuDescartar(componente.VlrComponenteTarifario, `Fio B ${componente.DscSubGrupoTarifario} (${componente.DatInicioVigencia})`, descartadas);
    if (valor === null) continue;
    fioBPorChave.set(chaveDaTarifa({
      subgrupo: componente.DscSubGrupoTarifario, modalidade: MODALIDADE, classe: componente.DscClasseConsumidor,
      subclasse: componente.DscSubClasseConsumidor, inicioVigencia: componente.DatInicioVigencia,
    }), valor);
  }
  return fioBPorChave;
}

// Junta tarifa e Fio B da mesma vigência. Linhas repetidas na ANEEL: vale a publicada por último (maior _id).
// Unidade errada recusa tudo (erro sistemático); valor ilegível descarta só a linha.
export function montarTarifas(tarifasDaAneel: TarifaDaAneel[], fioBDaAneel: FioBDaAneel[]): { tarifas: DadosDaTarifa[]; descartadas: string[] } {
  const descartadas: string[] = [];
  const fioBPorChave = lerFioB(fioBDaAneel, descartadas);
  const tarifasPorChave = new Map<string, DadosDaTarifa>();
  for (const linha of [...tarifasDaAneel].sort((a, b) => a._id - b._id)) {
    conferirUnidade(linha.DscUnidadeTerciaria, 'MWh');
    const descricao = `${linha.DscSubGrupo} ${linha.DscSubClasse} (${linha.DatInicioVigencia})`;
    const te = converterOuDescartar(linha.VlrTE, descricao, descartadas);
    const tusd = converterOuDescartar(linha.VlrTUSD, descricao, descartadas);
    if (te === null || tusd === null) continue;
    const tarifa: DadosDaTarifa = {
      subgrupo: linha.DscSubGrupo, modalidade: MODALIDADE, classe: linha.DscClasse, subclasse: linha.DscSubClasse,
      te, tusd, fioB: null, inicioVigencia: linha.DatInicioVigencia, fimVigencia: linha.DatFimVigencia || null,
    };
    tarifa.fioB = fioBPorChave.get(chaveDaTarifa(tarifa)) ?? null;
    tarifasPorChave.set(chaveDaTarifa(tarifa), tarifa);
  }
  return { tarifas: [...tarifasPorChave.values()], descartadas };
}

function problemaDaTarifa(tarifa: DadosDaTarifa): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarifa.inicioVigencia)) return 'início de vigência inválido';
  if (tarifa.fimVigencia && tarifa.fimVigencia <= tarifa.inicioVigencia) return 'fim da vigência antes do início';
  if (tarifa.tusd.lte(0)) return 'TUSD precisa ser positiva';
  if (tarifa.fioB && (tarifa.fioB.lte(0) || tarifa.fioB.gte(tarifa.tusd))) return 'Fio B precisa ser maior que zero e menor que a TUSD';
  const total = tarifa.te.plus(tarifa.tusd);
  if (total.lt(TARIFA_MINIMA) || total.gt(TARIFA_MAXIMA)) {
    return `TE + TUSD de ${total.toString()} fora da faixa de 0,10 a 2,00 por kWh`;
  }
  return null;
}

// Linha fora do esperado é descartada e listada; as outras da mesma distribuidora seguem. Erro de unidade
// atinge todas as linhas, então nenhuma sobra e a distribuidora fica com as tarifas anteriores.
export function separarTarifasValidas(tarifas: DadosDaTarifa[]): { validas: DadosDaTarifa[]; descartadas: string[] } {
  const validas: DadosDaTarifa[] = [];
  const descartadas: string[] = [];
  for (const tarifa of tarifas) {
    const problema = problemaDaTarifa(tarifa);
    if (problema) descartadas.push(`${tarifa.subgrupo} ${tarifa.subclasse} (${tarifa.inicioVigencia}): ${problema}`);
    else validas.push(tarifa);
  }
  return { validas, descartadas };
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

// Sigla da vigência mais recente: depois de uma incorporação, o mesmo CNPJ pode ter tido outra sigla no passado.
function siglaAtual(tarifas: TarifaDaAneel[]): string {
  return tarifas.reduce((maisRecente, tarifa) => (tarifa.DatInicioVigencia > maisRecente.DatInicioVigencia ? tarifa : maisRecente)).SigAgente;
}

function agruparPorCnpj<T>(linhas: T[], cnpjDe: (linha: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const linha of linhas) grupos.set(cnpjDe(linha), [...(grupos.get(cnpjDe(linha)) ?? []), linha]);
  return grupos;
}

// Versão da fonte: datas dos recursos e a lista de distribuidoras ligadas (distribuidora nova pede reimportação).
async function descreverFonte(agora: Date) {
  const [recursoDeTarifas, recursosDeComponentes, cnpjs] = await Promise.all([
    buscarRecursoDeTarifas(), buscarRecursosDeComponentes(Number(hojeEmSaoPaulo(agora).slice(0, 4))), listarCnpjsLigados(),
  ]);
  if (cnpjs.length === 0) throw new ErroDeImportacao('Nenhuma distribuidora ligada a municípios. Rode antes a importação aneel-distribuidoras.');
  const componentes = recursosDeComponentes.map((recurso) => `${recurso.ano} ${recurso.modificadoEm}`).join(', ');
  // Resumo (hash) da descrição completa: a coluna versao_da_fonte guarda até 100 caracteres.
  const descricao = `tarifas ${recursoDeTarifas.modificadoEm} | componentes ${componentes} | distribuidoras ${[...cnpjs].sort().join(',')}`;
  const versaoDaFonte = `${cnpjs.length} distribuidoras, sha256 ${createHash('sha256').update(descricao).digest('hex').slice(0, 32)}`;
  return { recursoDeTarifas, recursosDeComponentes, cnpjs, versaoDaFonte };
}

interface DistribuidoraPreparada {
  gravacao: GravacaoDaDistribuidora | null;
  avisos: string[];
}

// Monta e valida uma distribuidora; o que for descartado vai para a mensagem, sem barrar as outras.
function prepararDistribuidora(cnpj: string, tarifas: TarifaDaAneel[], fioB: FioBDaAneel[], gravadas: TarifaGravada[]): DistribuidoraPreparada {
  const sigla = siglaAtual(tarifas);
  try {
    const montadas = montarTarifas(tarifas, fioB);
    const { validas, descartadas } = separarTarifasValidas(montadas.tarifas);
    const avisos = [...montadas.descartadas, ...descartadas].map((descartada) => `${sigla} ${descartada}`);
    if (validas.length === 0) return { gravacao: null, avisos };
    return { gravacao: { distribuidora: { cnpj, sigla }, ...separarNovasEAlteradas(gravadas, validas) }, avisos };
  } catch (erro) {
    if (erro instanceof ErroDeImportacao) return { gravacao: null, avisos: [`${sigla}: ${erro.message}`] };
    throw erro;
  }
}

export async function importarTarifasDaAneel({ importacaoId, agora }: ContextoDaImportacao): Promise<ResultadoDaImportacao> {
  const fonte = await descreverFonte(agora);
  if (fonte.versaoDaFonte === await buscarVersaoDaUltimaImportacao(TIPO_TARIFAS_ANEEL)) return { status: 'sem_alteracao', linhasGravadas: 0, versaoDaFonte: fonte.versaoDaFonte };

  const tarifasPorCnpj = agruparPorCnpj(await buscarTarifas(fonte.recursoDeTarifas.id), (tarifa) => tarifa.NumCNPJDistribuidora);
  const fioBDosAnos = (await Promise.all(fonte.recursosDeComponentes.map((recurso) => buscarFioB(recurso.id)))).flat();
  const fioBPorCnpj = agruparPorCnpj(fioBDosAnos, (componente) => componente.NumCPFCNPJ);
  const gravadasPorCnpj = await listarTarifasPorCnpj();

  const preparadas = fonte.cnpjs.filter((cnpj) => tarifasPorCnpj.has(cnpj))
    .map((cnpj) => prepararDistribuidora(cnpj, tarifasPorCnpj.get(cnpj)!, fioBPorCnpj.get(cnpj) ?? [], gravadasPorCnpj.get(cnpj) ?? []));
  const gravacoes = preparadas.flatMap((preparada) => (preparada.gravacao ? [preparada.gravacao] : []));
  const avisos = preparadas.flatMap((preparada) => preparada.avisos);
  if (gravacoes.length === 0) throw new ErroDeImportacao(`Nenhuma distribuidora com tarifas válidas. ${avisos.slice(0, 3).join(' | ')}`);
  await gravarTarifas(gravacoes, importacaoId);
  return {
    status: 'sucesso',
    linhasGravadas: gravacoes.reduce((total, gravacao) => total + gravacao.novas.length + gravacao.alteradas.length, 0),
    versaoDaFonte: fonte.versaoDaFonte,
    ...(avisos.length > 0 && { mensagem: `${gravacoes.length} distribuidoras importadas; descartado: ${avisos.join(' | ')}` }),
  };
}
