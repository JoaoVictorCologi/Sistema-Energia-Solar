// Simulação pública: só lê o banco (tarifa, irradiação, indicadores) e o parametros.json; nunca chama a ANEEL.
import { Decimal } from 'decimal.js';
import { dimensionar } from '../motor/dimensionamento.ts';
import { simular, type EntradaSimulacao, type PremissasDaSimulacao } from '../motor/simular.ts';
import { fracao, kwh, reais, reaisPorKwh, type Alerta } from '../motor/tipos.ts';
import { ErroHttp } from '../middlewares/erros.ts';
import { parametros } from '../parametros/parametros.ts';
import { buscarUltimoIndicador } from '../repositories/indicadoresRepository.ts';
import { buscarIrradiacaoDoMunicipio, type IrradiacaoGravada } from '../repositories/irradiacaoRepository.ts';
import { inserirSimulacao } from '../repositories/simulacoesRepository.ts';
import { buscarTarifaVigente, type TarifaGravada } from '../repositories/tarifasRepository.ts';
import { hojeEmSaoPaulo } from '../utils/datas.ts';
import { consultarCep, type LocalDoCep } from './cepService.ts';
import { formatarSimulacao, type SimulacaoFormatada } from './simulacaoFormato.ts';

export type TipoLigacao = 'monofasico' | 'bifasico' | 'trifasico';
export type Subgrupo = 'B1' | 'B2' | 'B3';

export interface PedidoDeSimulacao {
  cep: string;
  tipoLigacao: TipoLigacao;
  subgrupo: Subgrupo;
  consumoMedioKwh: Decimal;
}

// Classe e subclasse da tarifa cheia de cada subgrupo, como a ANEEL publica.
const CLASSE_DO_SUBGRUPO: Record<Subgrupo, { classe: string; subclasse: string }> = {
  B1: { classe: 'Residencial', subclasse: 'Residencial' },
  B2: { classe: 'Rural', subclasse: 'Não se aplica' },
  B3: { classe: 'Não se aplica', subclasse: 'Não se aplica' },
};

const SERIE_IPCA_12_MESES = 13522;
const SERIE_SELIC_META = 432;

interface Referencias {
  tarifa: TarifaGravada & { fioB: Decimal };
  irradiacao: IrradiacaoGravada;
  reajusteAnual: Decimal;
  taxaDesconto: Decimal;
}

function dadosIndisponiveis(): ErroHttp {
  return new ErroHttp(503, 'SIMULACAO_INDISPONIVEL', 'O simulador está sem os dados de referência no momento. Tente mais tarde.');
}

async function buscarReferencias(local: LocalDoCep, subgrupo: Subgrupo, hoje: string): Promise<Referencias> {
  const [tarifa, irradiacao, ipca, selic] = await Promise.all([
    buscarTarifaVigente({ sigla: parametros.distribuidoraPadrao, subgrupo, ...CLASSE_DO_SUBGRUPO[subgrupo], data: hoje }),
    buscarIrradiacaoDoMunicipio(local.codigoIbge),
    buscarUltimoIndicador(SERIE_IPCA_12_MESES),
    buscarUltimoIndicador(SERIE_SELIC_META),
  ]);
  if (!tarifa?.fioB || !irradiacao || !ipca || !selic) throw dadosIndisponiveis();
  return { tarifa: { ...tarifa, fioB: tarifa.fioB }, irradiacao, reajusteAnual: ipca.valor.div(100), taxaDesconto: selic.valor.div(100) };
}

// ICMS de SP por faixa de consumo mensal: vale a primeira faixa que comporta o consumo médio.
function aliquotaDeIcms(consumoMedio: Decimal): Decimal {
  return parametros.impostos.icmsFaixas.find((faixa) => faixa.ateKwh === null || consumoMedio.lte(faixa.ateKwh))!.aliquota;
}

// A conexão prevista é o mês seguinte ao de hoje.
function mesSeguinte(hoje: string): { ano: number; mes: number } {
  const [ano, mes] = hoje.split('-').map(Number);
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

function montarPremissas(pedido: PedidoDeSimulacao, referencias: Referencias, investimento: Decimal): PremissasDaSimulacao {
  return {
    performanceRatio: fracao(parametros.performanceRatio),
    simultaneidade: fracao(parametros.simultaneidade[pedido.subgrupo]),
    coberturaAlvo: fracao(parametros.coberturaAlvo),
    consumoMinimo: kwh(parametros.consumoMinimoKwh[pedido.tipoLigacao]),
    percentualFioBPorAno: Object.fromEntries(Object.entries(parametros.fioBPercentualPorAno).map(([ano, percentual]) => [Number(ano), fracao(percentual)])),
    validadeDosCreditosMeses: parametros.validadeDosCreditosMeses,
    reajusteAnual: fracao(referencias.reajusteAnual),
    taxaDesconto: fracao(referencias.taxaDesconto),
    horizonteAnos: parametros.horizonteAnos,
    operacaoManutencaoAnual: fracao(parametros.operacaoManutencaoAnual),
    trocaDoInversor: { ano: parametros.trocaDoInversor.ano, custo: reais(investimento.times(parametros.trocaDoInversor.fracaoDoInvestimento)) },
  };
}

// Estimativa da simulação pública (kWp × custo de referência); a tela avisa "valor final na proposta".
function estimarInvestimento(pedido: PedidoDeSimulacao, referencias: Referencias): Decimal {
  const { kwpInstalado } = dimensionar({
    consumoMensal: Array.from({ length: 12 }, () => kwh(pedido.consumoMedioKwh)), hspMensal: referencias.irradiacao.hspMensal,
    performanceRatio: fracao(parametros.performanceRatio), coberturaAlvo: fracao(parametros.coberturaAlvo),
    potenciaModuloW: parametros.moduloReferencia.potenciaW, inversoresKw: [],
  });
  return kwpInstalado.times(parametros.custoReferenciaPorKwp);
}

function montarEntrada(pedido: PedidoDeSimulacao, referencias: Referencias, hoje: string): EntradaSimulacao {
  const { tarifa } = referencias;
  const investimento = estimarInvestimento(pedido, referencias);
  return {
    consumoMensal: Array.from({ length: 12 }, () => kwh(pedido.consumoMedioKwh)),
    hspMensal: referencias.irradiacao.hspMensal,
    tarifa: { te: reaisPorKwh(tarifa.te), tusd: reaisPorKwh(tarifa.tusd), fioB: reaisPorKwh(tarifa.fioB), adicionalBandeira: reaisPorKwh(0) },
    tributos: { icms: fracao(aliquotaDeIcms(pedido.consumoMedioKwh)), pis: fracao(parametros.impostos.pis), cofins: fracao(parametros.impostos.cofins), icmsSobreFioB: parametros.icmsSobreFioB },
    modulo: { potenciaW: parametros.moduloReferencia.potenciaW, degradacaoAnual: fracao(parametros.degradacaoAnualPadrao) },
    inversoresKw: parametros.inversoresReferenciaKw,
    investimento: reais(investimento),
    inicio: mesSeguinte(hoje),
    regime: 'GD_II',
    premissas: montarPremissas(pedido, referencias, investimento),
  };
}

function alertaDeTarifaVencida(tarifa: TarifaGravada, hoje: string): Alerta[] {
  if (!tarifa.fimVigencia || tarifa.fimVigencia >= hoje) return [];
  return [{ codigo: 'TARIFA_DESATUALIZADA', mensagem: `A tarifa usada venceu em ${tarifa.fimVigencia}; a nova ainda não foi importada da ANEEL.` }];
}

export async function simularEconomia(pedido: PedidoDeSimulacao, agora = new Date()): Promise<SimulacaoFormatada & { codigo: string }> {
  const local = await consultarCep(pedido.cep);
  if (!local.atendido) throw new ErroHttp(422, 'REGIAO_NAO_ATENDIDA', `Região ainda não atendida. Por enquanto, o simulador atende só o estado de ${parametros.uf}.`);
  const hoje = hojeEmSaoPaulo(agora);
  const referencias = await buscarReferencias(local, pedido.subgrupo, hoje);
  const entrada = montarEntrada(pedido, referencias, hoje);
  const resultado = simular(entrada);
  resultado.alertas.push(...alertaDeTarifaVencida(referencias.tarifa, hoje));

  const formatada = formatarSimulacao(entrada, resultado, { local, pedido, tarifa: referencias.tarifa, distribuidora: parametros.distribuidoraPadrao, versaoParametros: parametros.versao });
  const codigo = await inserirSimulacao({
    cep: pedido.cep, codigo_ibge: local.codigoIbge, tarifa_id: referencias.tarifa.id, irradiacao_id: referencias.irradiacao.id,
    versao_parametros: parametros.versao, entrada: { pedido, motor: entrada }, resultado: formatada,
  });
  return { codigo, ...formatada };
}
