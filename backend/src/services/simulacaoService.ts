// Simulação pública em qualquer município do Brasil: só lê o banco (tarifa, irradiação, indicadores) e os
// arquivos de parâmetros; nunca chama a ANEEL.
import { Decimal } from 'decimal.js';
import { dimensionar } from '../motor/dimensionamento.ts';
import { tarifaComImpostos, type Tributos } from '../motor/tarifa.ts';
import { simular, type EntradaSimulacao, type PremissasDaSimulacao } from '../motor/simular.ts';
import { fracao, kwh, reais, reaisPorKwh, type Alerta } from '../motor/tipos.ts';
import { ErroHttp } from '../middlewares/erros.ts';
import { parametros } from '../parametros/parametros.ts';
import { tributosDaUf } from '../parametros/tributos.ts';
import { listarFormasDePagamento, type ConfiguracaoVigente } from '../repositories/configuracoesRepository.ts';
import { buscarMunicipio } from '../repositories/municipiosRepository.ts';
import { buscarUltimoIndicador } from '../repositories/indicadoresRepository.ts';
import { buscarIrradiacaoDoMunicipio, type IrradiacaoGravada } from '../repositories/irradiacaoRepository.ts';
import { inserirSimulacao } from '../repositories/simulacoesRepository.ts';
import { buscarTarifaVigente, buscarUltimaTarifaComFioB, type FiltroDeTarifa, type TarifaGravada } from '../repositories/tarifasRepository.ts';
import { hojeEmSaoPaulo } from '../utils/datas.ts';
import { consultarCep, type LocalDoCep } from './cepService.ts';
import { obterConfiguracaoVigente } from './configuracoesService.ts';
import {
  alertasDasRespostas, aliquotaDaConta, coberturaDoPedido, consumoDoPedido, estimarParcela, fatorDoTelhado, modulosNaArea, origemDasPremissas, regimeDoPedido,
  simultaneidadeDoPedido, type OrigemDasPremissas, type RespostasDoCliente, type RevisaoDePremissas, type Subgrupo,
} from './refinamento.ts';
import { formatarSimulacao, type SimulacaoFormatada } from './simulacaoFormato.ts';

export type TipoLigacao = 'monofasico' | 'bifasico' | 'trifasico';

export interface PedidoDeSimulacao extends RespostasDoCliente {
  cep: string;
  tipoLigacao: TipoLigacao;
  subgrupo: Subgrupo;
  // Consumo de hoje: a média informada ou a do histórico de 12 meses.
  consumoMedioKwh: Decimal;
  // CNPJ escolhido pelo cliente; obrigatório quando o município tem mais de uma distribuidora.
  distribuidora?: string;
}

// O que o cálculo usa do pedido (a distribuidora entra pelas referências).
export type DadosDoPedido = Omit<PedidoDeSimulacao, 'distribuidora'>;

export interface DistribuidoraEscolhida {
  cnpj: string;
  sigla: string;
}

// Classe e subclasse da tarifa cheia de cada subgrupo, como a ANEEL publica.
const CLASSE_DO_SUBGRUPO: Record<Subgrupo, { classe: string; subclasse: string }> = {
  B1: { classe: 'Residencial', subclasse: 'Residencial' },
  B2: { classe: 'Rural', subclasse: 'Não se aplica' },
  B3: { classe: 'Não se aplica', subclasse: 'Não se aplica' },
};

const SERIE_IPCA_12_MESES = 13522;
const SERIE_SELIC_META = 432;

export interface Referencias {
  // UF do município: define o ICMS.
  uf: string;
  distribuidora: DistribuidoraEscolhida;
  tarifa: TarifaGravada & { fioB: Decimal };
  // Início da vigência de onde veio o Fio B, quando a vigência atual não tem o componente publicado.
  fioBDaVigencia: string | null;
  irradiacao: IrradiacaoGravada;
  reajusteAnual: Decimal;
  taxaDesconto: Decimal;
  configuracao: ConfiguracaoVigente;
}

function dadosIndisponiveis(): ErroHttp {
  return new ErroHttp(503, 'SIMULACAO_INDISPONIVEL', 'O simulador está sem os dados de referência no momento. Tente mais tarde.');
}

// Sem Fio B publicado na vigência atual: o último publicado, corrigido pela variação da TUSD desde então
// (o Fio B é parte da TUSD e acompanha os reajustes).
async function completarFioB(tarifa: TarifaGravada, filtro: FiltroDeTarifa): Promise<{ fioB: Decimal; fioBDaVigencia: string | null } | null> {
  if (tarifa.fioB) return { fioB: tarifa.fioB, fioBDaVigencia: null };
  const anterior = await buscarUltimaTarifaComFioB({ ...filtro, data: tarifa.inicioVigencia });
  if (!anterior?.fioB) return null;
  return { fioB: anterior.fioB.times(tarifa.tusd).div(anterior.tusd).toDecimalPlaces(6), fioBDaVigencia: anterior.inicioVigencia };
}

// Faltando qualquer referência, a simulação não roda: um resultado parcial enganaria o cliente.
export async function buscarReferencias(codigoIbge: number, subgrupo: Subgrupo, hoje: string, distribuidora: DistribuidoraEscolhida): Promise<Referencias> {
  const filtro = { cnpj: distribuidora.cnpj, subgrupo, ...CLASSE_DO_SUBGRUPO[subgrupo], data: hoje };
  const [municipio, tarifa, irradiacao, ipca, selic, configuracao] = await Promise.all([
    buscarMunicipio(codigoIbge),
    buscarTarifaVigente(filtro),
    buscarIrradiacaoDoMunicipio(codigoIbge),
    buscarUltimoIndicador(SERIE_IPCA_12_MESES),
    buscarUltimoIndicador(SERIE_SELIC_META),
    obterConfiguracaoVigente(),
  ]);
  const fioB = tarifa ? await completarFioB(tarifa, filtro) : null;
  if (!municipio || !tarifa || !fioB || !irradiacao || !ipca || !selic) throw dadosIndisponiveis();
  return {
    uf: municipio.uf, distribuidora, tarifa: { ...tarifa, fioB: fioB.fioB }, fioBDaVigencia: fioB.fioBDaVigencia,
    irradiacao, reajusteAnual: ipca.valor.div(100), taxaDesconto: selic.valor.div(100), configuracao,
  };
}

// Uma distribuidora: escolha automática. Mais de uma: o cliente escolhe, e o backend confere se ela atende o município.
export function escolherDistribuidora(local: LocalDoCep, cnpjPedido: string | undefined): DistribuidoraEscolhida {
  if (!local.atendido) throw new ErroHttp(422, 'REGIAO_NAO_ATENDIDA', 'Região ainda não atendida: não há distribuidora com tarifa para este município.');
  if (cnpjPedido === undefined) {
    if (local.distribuidoras.length === 1) return { cnpj: local.distribuidoras[0].cnpj, sigla: local.distribuidoras[0].sigla };
    throw new ErroHttp(400, 'DISTRIBUIDORA_OBRIGATORIA', 'Escolha a distribuidora da sua conta de luz.', { distribuidora: 'Escolha uma das distribuidoras do município.' });
  }
  const escolhida = local.distribuidoras.find((opcao) => opcao.cnpj === cnpjPedido);
  if (!escolhida) throw new ErroHttp(400, 'DISTRIBUIDORA_INVALIDA', 'Esta distribuidora não atende o município.', { distribuidora: 'Escolha uma das distribuidoras do município.' });
  return { cnpj: escolhida.cnpj, sigla: escolhida.sigla };
}

// A conexão prevista é o mês seguinte ao de hoje.
function mesSeguinte(hoje: string): { ano: number; mes: number } {
  const [ano, mes] = hoje.split('-').map(Number);
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

// O que muda entre a simulação pública (referências) e o orçamento (catálogo com preço).
export interface EquipamentosDaEntrada {
  modulo: { potenciaW: Decimal; degradacaoAnual: Decimal };
  inversoresKw: Decimal[];
  investimento: Decimal;
  custoDaTrocaDoInversor: Decimal;
}

// O que define o tamanho do sistema, igual na estimativa do preço e no motor. A revisão do operador tem prioridade.
function premissasDoSistema(pedido: DadosDoPedido, referencias: Referencias, revisao: RevisaoDePremissas) {
  const fator = fatorDoTelhado({ ...pedido.telhado, ...revisao.telhado });
  return {
    consumoMensal: consumoDoPedido(pedido.consumoMedioKwh, pedido).map(kwh),
    hspMensal: referencias.irradiacao.hspMensal.map((hsp) => hsp.times(fator)),
    performanceRatio: fracao(revisao.performanceRatio ?? parametros.performanceRatio),
    coberturaAlvo: fracao(coberturaDoPedido(parametros.coberturaAlvo, pedido.consumoMedioKwh, pedido)),
    numeroMaximoDeModulos: modulosNaArea(pedido.telhado?.areaM2),
    numeroFixoDeModulos: revisao.quantidadeDeModulos,
  };
}

function montarPremissas(pedido: DadosDoPedido, referencias: Referencias, custoDaTrocaDoInversor: Decimal, revisao: RevisaoDePremissas): PremissasDaSimulacao {
  const sistema = premissasDoSistema(pedido, referencias, revisao);
  return {
    performanceRatio: sistema.performanceRatio,
    simultaneidade: fracao(revisao.simultaneidade ?? simultaneidadeDoPedido(pedido.subgrupo, pedido.perfilDeConsumo)),
    coberturaAlvo: sistema.coberturaAlvo,
    numeroMaximoDeModulos: sistema.numeroMaximoDeModulos,
    numeroFixoDeModulos: sistema.numeroFixoDeModulos,
    consumoMinimo: kwh(parametros.consumoMinimoKwh[pedido.tipoLigacao]),
    percentualFioBPorAno: Object.fromEntries(Object.entries(parametros.fioBPercentualPorAno).map(([ano, percentual]) => [Number(ano), fracao(percentual)])),
    validadeDosCreditosMeses: parametros.validadeDosCreditosMeses,
    reajusteAnual: fracao(referencias.reajusteAnual),
    taxaDesconto: fracao(referencias.taxaDesconto),
    horizonteAnos: parametros.horizonteAnos,
    operacaoManutencaoAnual: fracao(parametros.operacaoManutencaoAnual),
    trocaDoInversor: { ano: parametros.trocaDoInversor.ano, custo: reais(custoDaTrocaDoInversor) },
  };
}

// Mesmo dimensionamento que o motor fará: o preço precisa do número de módulos antes de simular.
export function dimensionarPedido(pedido: DadosDoPedido, referencias: Referencias, potenciaModuloW: Decimal, inversoresKw: Decimal[], revisao: RevisaoDePremissas = {}) {
  return dimensionar({ ...premissasDoSistema(pedido, referencias, revisao), potenciaModuloW, inversoresKw });
}

// Estimativa da simulação pública (kWp × custo de referência); a tela avisa "valor final na proposta".
function equipamentosDeReferencia(pedido: DadosDoPedido, referencias: Referencias): EquipamentosDaEntrada {
  const { kwpInstalado } = dimensionarPedido(pedido, referencias, parametros.moduloReferencia.potenciaW, []);
  const investimento = kwpInstalado.times(referencias.configuracao.custoReferenciaPorKwp);
  return {
    modulo: { potenciaW: parametros.moduloReferencia.potenciaW, degradacaoAnual: parametros.degradacaoAnualPadrao },
    inversoresKw: parametros.inversoresReferenciaKw,
    investimento,
    custoDaTrocaDoInversor: investimento.times(parametros.trocaDoInversor.fracaoDoInvestimento),
  };
}

function tributosDoEstado(pedido: DadosDoPedido, uf: string) {
  const { icms, pis, cofins, icmsSobreFioB } = tributosDaUf(uf, pedido.consumoMedioKwh);
  return { icms: fracao(icms), pis: fracao(pis), cofins: fracao(cofins), icmsSobreFioB };
}

// A conta do cliente já traz todos os tributos: a alíquota implícita substitui o ICMS (PIS e COFINS ficam na média).
export function tributosDoPedido(pedido: DadosDoPedido, referencias: Referencias): { tributos: Tributos; contaUsada: boolean; contaIgnorada: boolean } {
  const tributos = tributosDoEstado(pedido, referencias.uf);
  const { te, tusd } = referencias.tarifa;
  const semImpostos = { te: reaisPorKwh(te), tusd: reaisPorKwh(tusd), fioB: reaisPorKwh(0), adicionalBandeira: reaisPorKwh(0) };
  const aliquota = aliquotaDaConta(pedido.conta, te.plus(tusd), tarifaComImpostos(semImpostos, tributos));
  if (!aliquota) return { tributos, contaUsada: false, contaIgnorada: pedido.conta !== undefined };
  return { tributos: { ...tributos, icms: fracao(aliquota.minus(tributos.pis).minus(tributos.cofins)) }, contaUsada: true, contaIgnorada: false };
}

// Entrada completa do motor. Sem equipamentos informados, usa os de referência da simulação pública.
export function montarEntrada(
  pedido: DadosDoPedido,
  referencias: Referencias,
  hoje: string,
  equipamentos: EquipamentosDaEntrada = equipamentosDeReferencia(pedido, referencias),
  revisao: RevisaoDePremissas = {},
): EntradaSimulacao {
  const { tarifa } = referencias;
  const sistema = premissasDoSistema(pedido, referencias, revisao);
  return {
    consumoMensal: sistema.consumoMensal,
    hspMensal: sistema.hspMensal,
    tarifa: { te: reaisPorKwh(tarifa.te), tusd: reaisPorKwh(tarifa.tusd), fioB: reaisPorKwh(tarifa.fioB), adicionalBandeira: reaisPorKwh(0) },
    tributos: tributosDoPedido(pedido, referencias).tributos,
    modulo: { potenciaW: equipamentos.modulo.potenciaW, degradacaoAnual: fracao(equipamentos.modulo.degradacaoAnual) },
    inversoresKw: equipamentos.inversoresKw,
    investimento: reais(equipamentos.investimento),
    inicio: mesSeguinte(hoje),
    regime: regimeDoPedido(pedido.solarExistente),
    premissas: montarPremissas(pedido, referencias, equipamentos.custoDaTrocaDoInversor, revisao),
  };
}

// PR e simultaneidade não vêm de API. Sem contas reais conferidas, são valores típicos em todo lugar;
// depois da calibração, só a distribuidora das contas deixa de ter o aviso. O que o cliente informou sai da frase.
function alertaDeCalibracao(distribuidora: DistribuidoraEscolhida, origem: OrigemDasPremissas): Alerta[] {
  const { calibracao } = parametros;
  const plural = origem.simultaneidade === 'estimado';
  const assunto = plural ? 'Aproveitamento do sistema e consumo simultâneo' : 'Aproveitamento do sistema';
  const valorTipico = plural ? 'são valores típicos' : 'é um valor típico';
  if (!calibracao.calibrada) {
    const semCalibracao = plural ? 'ainda não calibrados' : 'ainda não calibrado';
    return [{ codigo: 'PREMISSAS_NAO_CALIBRADAS', mensagem: `${assunto} ${valorTipico}, ${semCalibracao} com contas reais: o resultado é uma estimativa.` }];
  }
  if (distribuidora.cnpj === calibracao.cnpj) return [];
  const calibrado = plural ? 'foram calibrados' : 'foi calibrado';
  return [{ codigo: 'ESTIMATIVA_FORA_DA_REGIAO_CALIBRADA', mensagem: `${assunto} ${calibrado} com contas da ${calibracao.sigla}: para ${distribuidora.sigla}, ${valorTipico} e o resultado é uma estimativa.` }];
}

// Avisos sobre os dados usados: tarifa vencida, Fio B de vigência anterior e premissas sem calibração.
export function alertasDasReferencias(referencias: Referencias, hoje: string, origem: OrigemDasPremissas): Alerta[] {
  const alertas: Alerta[] = [];
  const { tarifa, fioBDaVigencia, distribuidora } = referencias;
  if (tarifa.fimVigencia && tarifa.fimVigencia < hoje) {
    alertas.push({ codigo: 'TARIFA_DESATUALIZADA', mensagem: `A tarifa usada venceu em ${tarifa.fimVigencia}; a nova ainda não foi importada da ANEEL.` });
  }
  if (fioBDaVigencia) {
    alertas.push({ codigo: 'FIO_B_DA_VIGENCIA_ANTERIOR', mensagem: `A ANEEL ainda não publicou o Fio B desta tarifa: usamos o de ${fioBDaVigencia}, corrigido pela variação da TUSD.` });
  }
  alertas.push(...alertaDeCalibracao(distribuidora, origem));
  return alertas;
}

export async function simularEconomia(pedido: PedidoDeSimulacao, agora = new Date()): Promise<SimulacaoFormatada & { codigo: string }> {
  const hoje = hojeEmSaoPaulo(agora);
  const local = await consultarCep(pedido.cep, hoje);
  const distribuidora = escolherDistribuidora(local, pedido.distribuidora);
  const referencias = await buscarReferencias(local.codigoIbge, pedido.subgrupo, hoje, distribuidora);
  const entrada = montarEntrada(pedido, referencias, hoje);
  const resultado = simular(entrada);
  const { contaUsada, contaIgnorada } = tributosDoPedido(pedido, referencias);
  const origem = origemDasPremissas(pedido, contaUsada);
  resultado.alertas.push(...alertasDasReferencias(referencias, hoje, origem), ...alertasDasRespostas(pedido, contaIgnorada, pedido.consumoMedioKwh));

  const formatada = formatarSimulacao(entrada, resultado, {
    local, pedido, tarifa: referencias.tarifa, distribuidora: distribuidora.sigla, versaoParametros: parametros.versao, origem,
    fatorDoTelhado: fatorDoTelhado(pedido.telhado), parcelaEstimada: estimarParcela(entrada.investimento, pedido.pagamentoPreferido, await listarFormasDePagamento(true)),
  });
  const codigo = await inserirSimulacao({
    cep: pedido.cep, codigo_ibge: local.codigoIbge, tarifa_id: referencias.tarifa.id, irradiacao_id: referencias.irradiacao.id,
    versao_parametros: parametros.versao, entrada: { pedido: { ...pedido, distribuidora }, motor: entrada }, resultado: formatada,
  });
  return { codigo, ...formatada };
}
