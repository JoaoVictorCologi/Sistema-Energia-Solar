// Proposta: refaz a simulação com os equipamentos do catálogo e o preço calculado aqui, e guarda tudo
// num snapshot. Reabrir a proposta lê o snapshot; mudar tarifa ou preço depois não altera propostas emitidas.
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { simular } from '../motor/simular.ts';
import { ErroHttp } from '../middlewares/erros.ts';
import { parametros } from '../parametros/parametros.ts';
import { buscarClientePorId, type ClienteResumo } from '../repositories/clientesRepository.ts';
import type { EquipamentoDoCatalogo } from '../repositories/equipamentosRepository.ts';
import {
  atualizarStatusDaProposta, buscarProposta, gravarPropostaComPrecosDoCatalogo, listarPropostas, type FiltroDePropostas, type PropostaGravada,
} from '../repositories/propostasRepository.ts';
import { buscarSimulacaoPorCodigo, type SimulacaoGravada } from '../repositories/simulacoesRepository.ts';
import type { StatusDaProposta } from '../tipos/tabelas.ts';
import { hojeEmSaoPaulo, somarDias } from '../utils/datas.ts';
import { comoEquipamentoDaApi } from './equipamentosService.ts';
import { formatarSimulacao, type SimulacaoFormatada } from './simulacaoFormato.ts';
import {
  alertaDeTarifaVencida, buscarReferencias, dimensionarPedido, montarEntrada, type PedidoDeSimulacao, type Referencias,
} from './simulacaoService.ts';

// O pedido gravado na simulação (Decimal vira texto no JSONB).
const esquemaPedidoGravado = z.object({
  cep: z.string(),
  tipoLigacao: z.enum(['monofasico', 'bifasico', 'trifasico']),
  subgrupo: z.enum(['B1', 'B2', 'B3']),
  consumoMedioKwh: z.string().transform((valor) => new Decimal(valor)),
});

interface ContextoDaProposta {
  simulacao: SimulacaoGravada;
  cliente: ClienteResumo;
  pedido: PedidoDeSimulacao;
  referencias: Referencias;
  hoje: string;
}

const dinheiro = (valor: Decimal) => valor.toDecimalPlaces(2).toNumber();

function conferirEquipamento(equipamento: EquipamentoDoCatalogo | undefined, tipo: 'modulo' | 'inversor'): EquipamentoDoCatalogo {
  if (equipamento?.tipo === tipo) return equipamento;
  const nome = tipo === 'modulo' ? 'um módulo' : 'um inversor';
  throw new ErroHttp(400, 'EQUIPAMENTO_INVALIDO', `Escolha ${nome} ativo do catálogo.`, { [`${tipo}Id`]: `Não é ${nome} ativo do catálogo.` });
}

// Preço = (módulos + inversor + instalação por kWp) × (1 + margem), tudo do catálogo e do parametros.json.
function calcularPreco(contexto: ContextoDaProposta, modulo: EquipamentoDoCatalogo, inversor: EquipamentoDoCatalogo) {
  const dimensionamento = dimensionarPedido(contexto.pedido, contexto.referencias, modulo.potenciaW, [inversor.potenciaW.div(1000)]);
  const modulos = modulo.preco.times(dimensionamento.numeroModulos);
  const instalacao = dimensionamento.kwpInstalado.times(parametros.proposta.instalacaoPorKwp);
  const subtotal = modulos.plus(inversor.preco).plus(instalacao);
  const investimento = subtotal.times(parametros.proposta.margem.plus(1)).toDecimalPlaces(2);
  return { quantidadeDeModulos: dimensionamento.numeroModulos, modulos, instalacao, margem: investimento.minus(subtotal), investimento };
}

function montarProposta(contexto: ContextoDaProposta, modulo: EquipamentoDoCatalogo, inversor: EquipamentoDoCatalogo) {
  const preco = calcularPreco(contexto, modulo, inversor);
  const entrada = montarEntrada(contexto.pedido, contexto.referencias, contexto.hoje, {
    modulo: { potenciaW: modulo.potenciaW, degradacaoAnual: modulo.degradacaoAnual ?? parametros.degradacaoAnualPadrao },
    inversoresKw: [inversor.potenciaW.div(1000)],
    investimento: preco.investimento,
    custoDaTrocaDoInversor: inversor.preco,
  });
  const resultado = simular(entrada);
  resultado.alertas.push(...alertaDeTarifaVencida(contexto.referencias.tarifa, contexto.hoje));
  const { local } = contexto.simulacao.resultado as SimulacaoFormatada;
  const { investimentoEstimado: _estimativaDaSimulacaoPublica, ...simulacaoDaProposta } = formatarSimulacao(entrada, resultado, {
    local, pedido: contexto.pedido, tarifa: contexto.referencias.tarifa, distribuidora: parametros.distribuidoraPadrao, versaoParametros: parametros.versao,
  });
  return { preco, entrada, simulacaoDaProposta };
}

function montarSnapshot(contexto: ContextoDaProposta, modulo: EquipamentoDoCatalogo, inversor: EquipamentoDoCatalogo) {
  const { preco, entrada, simulacaoDaProposta } = montarProposta(contexto, modulo, inversor);
  const { cliente } = contexto;
  return {
    investimento: preco.investimento,
    snapshot: {
      cliente: { nome: cliente.nome, email: cliente.email, telefone: cliente.telefone, cep: cliente.cep },
      equipamentos: {
        modulo: { ...comoEquipamentoDaApi(modulo), quantidade: preco.quantidadeDeModulos },
        inversor: { ...comoEquipamentoDaApi(inversor), quantidade: 1 },
      },
      precos: { modulos: dinheiro(preco.modulos), inversor: dinheiro(inversor.preco), instalacao: dinheiro(preco.instalacao), margem: dinheiro(preco.margem), investimento: dinheiro(preco.investimento) },
      ...simulacaoDaProposta,
      emitidaEm: contexto.hoje,
      entradaDoMotor: entrada,
    },
  };
}

async function carregarContexto(codigoDaSimulacao: string, agora: Date): Promise<ContextoDaProposta> {
  const simulacao = await buscarSimulacaoPorCodigo(codigoDaSimulacao);
  if (!simulacao) throw new ErroHttp(404, 'SIMULACAO_NAO_ENCONTRADA', 'Simulação não encontrada.');
  const cliente = simulacao.cliente_id === null ? undefined : await buscarClientePorId(simulacao.cliente_id);
  if (!cliente) throw new ErroHttp(422, 'SIMULACAO_SEM_CLIENTE', 'Esta simulação não tem pedido de proposta de um cliente.');
  const pedido = esquemaPedidoGravado.parse((simulacao.entrada as { pedido: unknown }).pedido);
  const hoje = hojeEmSaoPaulo(agora);
  return { simulacao, cliente, pedido, referencias: await buscarReferencias(simulacao.codigo_ibge, pedido.subgrupo, hoje), hoje };
}

// A entrada completa do motor fica no snapshot para reproduzir o cálculo, mas não vai para a tela.
export function comoPropostaDaApi(proposta: PropostaGravada) {
  const { entradaDoMotor: _paraAuditoria, ...snapshot } = proposta.snapshot as { entradaDoMotor?: unknown };
  return {
    id: proposta.id, clienteId: proposta.clienteId, status: proposta.status, investimento: dinheiro(proposta.investimento),
    validaAte: proposta.validaAte, criadaEm: proposta.criadoEm, ...snapshot,
  };
}

export async function gerarProposta(pedido: { simulacao: string; moduloId: number; inversorId: number }, agora = new Date()) {
  const contexto = await carregarContexto(pedido.simulacao, agora);
  const id = await gravarPropostaComPrecosDoCatalogo({ moduloId: pedido.moduloId, inversorId: pedido.inversorId }, (modulo, inversor) => ({
    clienteId: contexto.cliente.id,
    simulacaoId: contexto.simulacao.id,
    validaAte: somarDias(contexto.hoje, parametros.proposta.validadeDias),
    ...montarSnapshot(contexto, conferirEquipamento(modulo, 'modulo'), conferirEquipamento(inversor, 'inversor')),
  }));
  return abrirProposta(id);
}

// Só lê o snapshot: nada é recalculado.
export async function abrirProposta(id: number) {
  const proposta = await buscarProposta(id);
  if (!proposta) throw new ErroHttp(404, 'PROPOSTA_NAO_ENCONTRADA', 'Proposta não encontrada.');
  return comoPropostaDaApi(proposta);
}

export async function mudarStatusDaProposta(id: number, status: StatusDaProposta) {
  if (!(await atualizarStatusDaProposta(id, status))) throw new ErroHttp(404, 'PROPOSTA_NAO_ENCONTRADA', 'Proposta não encontrada.');
  return abrirProposta(id);
}

export async function buscarPropostas(filtro: FiltroDePropostas, agora = new Date()) {
  const hoje = hojeEmSaoPaulo(agora);
  const { propostas, total } = await listarPropostas(filtro);
  return {
    propostas: propostas.map((proposta) => ({ ...proposta, investimento: dinheiro(proposta.investimento), vencida: proposta.validaAte < hoje })),
    pagina: filtro.pagina, porPagina: filtro.porPagina, total,
  };
}
