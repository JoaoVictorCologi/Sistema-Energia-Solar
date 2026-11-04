// Consultas da área restrita: painel, clientes e simulações. Devolvem só o que a tela precisa, nunca a linha inteira.
import { ErroHttp } from '../middlewares/erros.ts';
import { buscarClientePorId, listarClientes, type ClienteResumo } from '../repositories/clientesRepository.ts';
import { listarUltimasImportacoes } from '../repositories/importacoesRepository.ts';
import { contarPropostasVencidas, contarTotais, somarAceitasDesde } from '../repositories/painelRepository.ts';
import { contarPropostasPorStatus } from '../repositories/propostasRepository.ts';
import { listarSimulacoes, listarSimulacoesDoCliente, type FiltroDeSimulacoes, type SimulacaoDoCliente } from '../repositories/simulacoesRepository.ts';
import { hojeEmSaoPaulo } from '../utils/datas.ts';
import type { SimulacaoFormatada } from './simulacaoFormato.ts';
import { buscarPropostas } from './propostasService.ts';
import { TIPO_TARIFAS_ANEEL } from './tarifasAneelService.ts';

function comoClienteDaLista(cliente: ClienteResumo) {
  return { id: cliente.id, nome: cliente.nome, email: cliente.email, telefone: cliente.telefone, criadoEm: cliente.criado_em };
}

// O resultado gravado é a própria resposta da simulação pública.
function resumirResultado(resultado: unknown) {
  const simulacao = resultado as SimulacaoFormatada;
  return {
    cidade: simulacao.local.cidade,
    distribuidora: simulacao.premissas?.distribuidora ?? null,
    tipoLigacao: simulacao.pedido.tipoLigacao,
    consumoMedioKwh: simulacao.pedido.consumoMedioKwh,
    kwpInstalado: simulacao.dimensionamento.kwpInstalado,
    investimentoEstimado: simulacao.investimentoEstimado.valor,
    economiaMensalMedia: simulacao.indicadores.economiaMensalMedia,
  };
}

function comoResumoDaSimulacao({ codigo, criado_em, resultado, entrada }: SimulacaoDoCliente) {
  // As respostas do cliente como foram gravadas, para o operador orçar.
  const { pedido } = (entrada ?? {}) as { pedido?: unknown };
  return { codigo, criadaEm: criado_em, ...resumirResultado(resultado), respostas: pedido ?? null };
}

export async function montarPainel(agora = new Date()) {
  const hoje = hojeEmSaoPaulo(agora);
  const [totais, propostasPorStatus, propostasVencidas, valorAceitoNoMes, ultimas] = await Promise.all([
    contarTotais(), contarPropostasPorStatus(), contarPropostasVencidas(hoje), somarAceitasDesde(`${hoje.slice(0, 7)}-01`), listarUltimasImportacoes(),
  ]);
  const tarifas = ultimas.find((importacao) => importacao.tipo === TIPO_TARIFAS_ANEEL);
  return {
    ...totais,
    propostasPorStatus,
    propostasVencidas,
    valorAceitoNoMes: valorAceitoNoMes.toDecimalPlaces(2).toNumber(),
    ultimaImportacaoDeTarifas: tarifas ? { status: tarifas.status, finalizadaEm: tarifas.finalizada_em } : null,
  };
}

export async function buscarSimulacoes(filtro: FiltroDeSimulacoes) {
  const { simulacoes, total } = await listarSimulacoes(filtro);
  return {
    simulacoes: simulacoes.map((item) => ({
      codigo: item.codigo, criadaEm: item.criado_em, ...resumirResultado(item.resultado), cidade: item.cidade, uf: item.uf,
      cliente: item.cliente_id === null ? null : { id: item.cliente_id, nome: item.cliente_nome },
    })),
    pagina: filtro.pagina, porPagina: filtro.porPagina, total,
  };
}

export async function buscarClientes(filtro: { busca?: string; pagina: number; porPagina: number }) {
  const { clientes, total } = await listarClientes(filtro);
  return { clientes: clientes.map(comoClienteDaLista), pagina: filtro.pagina, porPagina: filtro.porPagina, total };
}

export async function detalharCliente(id: number) {
  const cliente = await buscarClientePorId(id);
  if (!cliente) throw new ErroHttp(404, 'CLIENTE_NAO_ENCONTRADO', 'Cliente não encontrado.');
  const [simulacoes, { propostas }] = await Promise.all([listarSimulacoesDoCliente(id), buscarPropostas({ clienteId: id, pagina: 1, porPagina: 100 })]);
  return {
    cliente: {
      ...comoClienteDaLista(cliente), cep: cliente.cep, aceiteEm: cliente.aceite_em, contatoPreferido: cliente.contato_preferido, melhorHorario: cliente.melhor_horario,
      autorizaUsoParaCalibracao: cliente.autoriza_calibracao,
      endereco: cliente.logradouro ? { logradouro: cliente.logradouro, numero: cliente.numero, complemento: cliente.complemento, bairro: cliente.bairro } : null,
    },
    simulacoes: simulacoes.map(comoResumoDaSimulacao),
    propostas: propostas.map(({ id: propostaId, status, investimento, validaAte, vencida, criadoEm }) => ({ id: propostaId, status, investimento, validaAte, vencida, criadoEm })),
  };
}
