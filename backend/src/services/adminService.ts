// Consultas da área restrita: painel e clientes. Só o que a tela precisa, nunca a linha inteira.
import { ErroHttp } from '../middlewares/erros.ts';
import { buscarClientePorId, listarClientes, type ClienteResumo } from '../repositories/clientesRepository.ts';
import { listarUltimasImportacoes } from '../repositories/importacoesRepository.ts';
import { contarTotais } from '../repositories/painelRepository.ts';
import { contarPropostasPorStatus } from '../repositories/propostasRepository.ts';
import { listarSimulacoesDoCliente, type SimulacaoDoCliente } from '../repositories/simulacoesRepository.ts';
import type { SimulacaoFormatada } from './simulacaoFormato.ts';
import { buscarPropostas } from './propostasService.ts';
import { TIPO_TARIFAS_ANEEL } from './tarifasAneelService.ts';

function comoClienteDaLista(cliente: ClienteResumo) {
  return { id: cliente.id, nome: cliente.nome, email: cliente.email, telefone: cliente.telefone, criadoEm: cliente.criado_em };
}

// O resultado gravado é a própria resposta da simulação pública (simulacaoFormato.ts).
function comoResumoDaSimulacao({ codigo, criado_em, resultado }: SimulacaoDoCliente) {
  const simulacao = resultado as SimulacaoFormatada;
  return {
    codigo,
    criadaEm: criado_em,
    cidade: simulacao.local.cidade,
    tipoLigacao: simulacao.pedido.tipoLigacao,
    consumoMedioKwh: simulacao.pedido.consumoMedioKwh,
    kwpInstalado: simulacao.dimensionamento.kwpInstalado,
    investimentoEstimado: simulacao.investimentoEstimado.valor,
    economiaMensalMedia: simulacao.indicadores.economiaMensalMedia,
  };
}

export async function montarPainel() {
  const [totais, propostasPorStatus, ultimas] = await Promise.all([contarTotais(), contarPropostasPorStatus(), listarUltimasImportacoes()]);
  const tarifas = ultimas.find((importacao) => importacao.tipo === TIPO_TARIFAS_ANEEL);
  return {
    ...totais,
    propostasPorStatus,
    ultimaImportacaoDeTarifas: tarifas ? { status: tarifas.status, finalizadaEm: tarifas.finalizada_em } : null,
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
    cliente: { ...comoClienteDaLista(cliente), cep: cliente.cep, aceiteEm: cliente.aceite_em },
    simulacoes: simulacoes.map(comoResumoDaSimulacao),
    propostas: propostas.map(({ id: propostaId, status, investimento, validaAte, vencida, criadoEm }) => ({ id: propostaId, status, investimento, validaAte, vencida, criadoEm })),
  };
}
