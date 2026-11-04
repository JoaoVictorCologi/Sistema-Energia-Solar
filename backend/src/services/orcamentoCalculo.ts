// Cálculo do orçamento: preço do catálogo, ajustes do operador, condições de pagamento e snapshot.
// Preço = (módulos + inversor + instalação por kWp) × (1 + margem); o valor final soma os ajustes, sempre aqui no backend.
import { Decimal } from 'decimal.js';
import { parcelaPrice } from '../motor/financeiro.ts';
import { simular } from '../motor/simular.ts';
import { ErroHttp } from '../middlewares/erros.ts';
import { parametros } from '../parametros/parametros.ts';
import type { ClienteResumo } from '../repositories/clientesRepository.ts';
import type { EquipamentoDoCatalogo } from '../repositories/equipamentosRepository.ts';
import type { AjusteGravado, CondicaoGravada, EstadoDoRascunho, PropostaCalculada } from '../repositories/propostasRepository.ts';
import type { SimulacaoGravada } from '../repositories/simulacoesRepository.ts';
import { somarDias } from '../utils/datas.ts';
import { comoEquipamentoDaApi } from './equipamentosService.ts';
import { alertasDasRespostas, fatorDoTelhado, origemDasPremissas, type RevisaoDePremissas } from './refinamento.ts';
import { formatarSimulacao, type SimulacaoFormatada } from './simulacaoFormato.ts';
import {
  alertasDasReferencias, dimensionarPedido, montarEntrada, tributosDoPedido, type DadosDoPedido, type DistribuidoraEscolhida, type Referencias,
} from './simulacaoService.ts';

export interface ContextoDaProposta {
  simulacao: SimulacaoGravada;
  cliente: ClienteResumo;
  pedido: DadosDoPedido & { distribuidora: DistribuidoraEscolhida };
  referencias: Referencias;
  hoje: string;
}

const dinheiro = (valor: Decimal) => valor.toDecimalPlaces(2).toNumber();

// O equipamento vem da consulta de ativos: ausente ou de outro tipo significa escolha inválida.
function conferirEquipamento(equipamento: EquipamentoDoCatalogo | undefined, tipo: 'modulo' | 'inversor'): EquipamentoDoCatalogo {
  if (equipamento?.tipo === tipo) return equipamento;
  const nome = tipo === 'modulo' ? 'um módulo' : 'um inversor';
  throw new ErroHttp(400, 'EQUIPAMENTO_INVALIDO', `Escolha ${nome} ativo do catálogo.`, { [`${tipo}Id`]: `Não é ${nome} ativo do catálogo.` });
}

// A revisão fica gravada em JSON nas escolhas da proposta.
export function lerRevisao(gravada: Record<string, unknown> | undefined): RevisaoDePremissas {
  const { performanceRatio, simultaneidade, telhado, quantidadeDeModulos } = (gravada ?? {}) as Record<string, number | undefined> & { telhado?: RevisaoDePremissas['telhado'] };
  return {
    ...(performanceRatio !== undefined && { performanceRatio: new Decimal(String(performanceRatio)) }),
    ...(simultaneidade !== undefined && { simultaneidade: new Decimal(String(simultaneidade)) }),
    ...(telhado !== undefined && { telhado }),
    ...(quantidadeDeModulos !== undefined && { quantidadeDeModulos }),
  };
}

// A quantidade de módulos vem do mesmo dimensionamento do motor, com o módulo e o inversor escolhidos.
function calcularPreco(contexto: ContextoDaProposta, modulo: EquipamentoDoCatalogo, inversor: EquipamentoDoCatalogo, revisao: RevisaoDePremissas) {
  const { configuracao } = contexto.referencias;
  const dimensionamento = dimensionarPedido(contexto.pedido, contexto.referencias, modulo.potenciaW, [inversor.potenciaW.div(1000)], revisao);
  const modulos = modulo.preco.times(dimensionamento.numeroModulos);
  const instalacao = dimensionamento.kwpInstalado.times(configuracao.instalacaoPorKwp);
  const subtotal = modulos.plus(inversor.preco).plus(instalacao);
  const calculado = subtotal.times(configuracao.margem.plus(1)).toDecimalPlaces(2);
  return { quantidadeDeModulos: dimensionamento.numeroModulos, modulos, instalacao, margem: calculado.minus(subtotal), calculado };
}

// Percentual vale sobre o preço calculado. Descontos acima do limite do painel exigem justificativa.
function aplicarAjustes(calculado: Decimal, ajustes: AjusteGravado[], limiteDesconto: Decimal) {
  const itens = ajustes.map((ajuste) => {
    const valor = (ajuste.modo === 'percentual' ? calculado.times(ajuste.valor) : ajuste.valor).toDecimalPlaces(2);
    return { ...ajuste, valorEmReais: ajuste.tipo === 'desconto' ? valor.neg() : valor };
  });
  const descontos = itens.filter((item) => item.tipo === 'desconto');
  const totalDeDescontos = descontos.reduce((total, item) => total.plus(item.valorEmReais.abs()), new Decimal(0));
  if (totalDeDescontos.gt(calculado.times(limiteDesconto)) && !descontos.some((item) => item.justificativa)) {
    throw new ErroHttp(400, 'JUSTIFICATIVA_OBRIGATORIA', `Desconto acima de ${limiteDesconto.times(100).toString().replace('.', ',')}% precisa de justificativa.`, { justificativa: 'Explique o motivo do desconto.' });
  }
  const total = itens.reduce((soma, item) => soma.plus(item.valorEmReais), new Decimal(0));
  const valorFinal = calculado.plus(total);
  if (valorFinal.lte(0)) throw new ErroHttp(400, 'VALOR_FINAL_INVALIDO', 'Os ajustes deixariam o orçamento sem valor a pagar.');
  return { itens, total, valorFinal };
}

// Vale para a condição gravada e para a que está entrando: o valor final pode ter mudado.
function calcularCondicao(condicao: CondicaoGravada, valorFinal: Decimal, economiaMensal: Decimal) {
  const base = { id: condicao.id, formaPagamentoId: condicao.formaPagamentoId, nome: condicao.nome, tipo: condicao.tipo, taxaMensal: condicao.taxaMensal.toNumber(), parcelas: condicao.parcelas, carenciaDias: condicao.carenciaDias };
  if (condicao.tipo === 'avista') {
    const total = valorFinal.times(new Decimal(1).minus(condicao.descontoAvista)).toDecimalPlaces(2);
    return { ...base, entrada: 0, valorParcela: total.toNumber(), valorTotal: total.toNumber(), economiaMensalMenosParcela: null };
  }
  const minima = valorFinal.times(condicao.entradaMinima).toDecimalPlaces(2);
  const entrada = condicao.entrada ?? minima;
  if (entrada.lt(minima) || entrada.gte(valorFinal)) {
    throw new ErroHttp(400, 'ENTRADA_INVALIDA', 'Dados inválidos. Confira os campos.', { entrada: `A entrada de ${condicao.nome} precisa ficar entre R$ ${minima.toFixed(2)} e o valor final.` });
  }
  const parcela = parcelaPrice(valorFinal.minus(entrada), condicao.taxaMensal, condicao.parcelas, condicao.carenciaDias / 30).toDecimalPlaces(2);
  return {
    ...base, entrada: dinheiro(entrada), valorParcela: parcela.toNumber(), valorTotal: dinheiro(entrada.plus(parcela.times(condicao.parcelas))),
    economiaMensalMenosParcela: dinheiro(economiaMensal.minus(parcela)),
  };
}

// O que o simulador mostrou ao cliente, para comparar com o valor final na impressão.
function estimadoPeloSimulador(simulacao: SimulacaoGravada) {
  const { investimentoEstimado, indicadores, dimensionamento } = simulacao.resultado as SimulacaoFormatada;
  return {
    investimento: investimentoEstimado?.valor ?? null, economiaMensalMedia: indicadores?.economiaMensalMedia ?? null,
    paybackSimplesAnos: indicadores?.paybackSimplesAnos ?? null, kwpInstalado: dimensionamento?.kwpInstalado ?? null,
  };
}

// O motor roda com o valor final como investimento: payback e TIR refletem o preço real, e a troca do inversor usa o preço do catálogo.
function simularOrcamento(contexto: ContextoDaProposta, modulo: EquipamentoDoCatalogo, inversor: EquipamentoDoCatalogo, valorFinal: Decimal, revisao: RevisaoDePremissas) {
  const { pedido, referencias, hoje } = contexto;
  const entrada = montarEntrada(pedido, referencias, hoje, {
    modulo: { potenciaW: modulo.potenciaW, degradacaoAnual: modulo.degradacaoAnual ?? parametros.degradacaoAnualPadrao },
    inversoresKw: [inversor.potenciaW.div(1000)],
    investimento: valorFinal,
    custoDaTrocaDoInversor: inversor.preco,
  }, revisao);
  const resultado = simular(entrada);
  const { contaUsada, contaIgnorada } = tributosDoPedido(pedido, referencias);
  const origem = origemDasPremissas(pedido, contaUsada, revisao);
  resultado.alertas.push(...alertasDasReferencias(referencias, hoje, origem), ...alertasDasRespostas(pedido, contaIgnorada, pedido.consumoMedioKwh));
  const { local } = contexto.simulacao.resultado as SimulacaoFormatada;
  const formatada = formatarSimulacao(entrada, resultado, {
    local, pedido, tarifa: referencias.tarifa, distribuidora: pedido.distribuidora.sigla, versaoParametros: parametros.versao, origem,
    fatorDoTelhado: fatorDoTelhado({ ...pedido.telhado, ...revisao.telhado }), parcelaEstimada: null,
  });
  return { entrada, resultado, formatada };
}

// Monta tudo o que o orçamento mostra. Roda a cada alteração do rascunho e no envio; o snapshot resultante é o que fica gravado.
export function montarOrcamento(contexto: ContextoDaProposta, estado: EstadoDoRascunho): PropostaCalculada {
  const modulo = conferirEquipamento(estado.modulo, 'modulo');
  const inversor = conferirEquipamento(estado.inversor, 'inversor');
  const revisao = lerRevisao(estado.escolhas.revisao);
  const { configuracao } = contexto.referencias;
  const preco = calcularPreco(contexto, modulo, inversor, revisao);
  const { itens, total, valorFinal } = aplicarAjustes(preco.calculado, estado.ajustes, configuracao.limiteDesconto);
  const { entrada, resultado, formatada } = simularOrcamento(contexto, modulo, inversor, valorFinal, revisao);
  // Estimativa e parcela de referência são da simulação pública: aqui valem o valor final e as condições.
  const { investimentoEstimado: _estimativa, parcelaEstimada: _parcela, ...simulacaoDoOrcamento } = formatada;
  const { cliente } = contexto;
  return {
    investimento: valorFinal,
    validaAte: somarDias(contexto.hoje, configuracao.validadeDias),
    snapshot: {
      cliente: { nome: cliente.nome, email: cliente.email, telefone: cliente.telefone, cep: cliente.cep },
      equipamentos: {
        modulo: { ...comoEquipamentoDaApi(modulo), quantidade: preco.quantidadeDeModulos },
        inversor: { ...comoEquipamentoDaApi(inversor), quantidade: 1 },
      },
      precos: {
        modulos: dinheiro(preco.modulos), inversor: dinheiro(inversor.preco), instalacao: dinheiro(preco.instalacao), margem: dinheiro(preco.margem),
        calculado: dinheiro(preco.calculado), ajustes: dinheiro(total), investimento: dinheiro(valorFinal),
      },
      ajustes: itens.map(({ valor, valorEmReais, ...item }) => ({ ...item, valor: valor.toNumber(), valorEmReais: dinheiro(valorEmReais) })),
      condicoes: estado.condicoes.map((condicao) => calcularCondicao(condicao, valorFinal, resultado.indicadores.economiaPrimeiroAno.div(12))),
      revisao: estado.escolhas.revisao ?? null,
      estimadoPeloSimulador: estimadoPeloSimulador(contexto.simulacao),
      configuracaoUsada: {
        margem: configuracao.margem.toNumber(), instalacaoPorKwp: configuracao.instalacaoPorKwp.toNumber(),
        validadeDias: configuracao.validadeDias, limiteDesconto: configuracao.limiteDesconto.toNumber(),
      },
      ...simulacaoDoOrcamento,
      emitidaEm: contexto.hoje,
      entradaDoMotor: entrada,
    },
  };
}
