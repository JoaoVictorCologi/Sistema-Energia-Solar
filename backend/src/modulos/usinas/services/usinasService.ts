// Regras de negócio de usinas e equipamentos: combina as regras puras com os dados do repository e monta o que a API devolve.
import type { Knex } from 'knex';
import { ErroHttp } from '../../../middlewares/erros.ts';
import { buscarClientePorId } from '../../../repositories/clientesRepository.ts';
import { buscarMunicipio } from '../../../repositories/municipiosRepository.ts';
import {
  atualizarEquipamentoDaUsina, atualizarUsina, buscarEquipamentoDaUsina, buscarMunicipiosPorNome, buscarUsinaPorId, comUsinaTravada, existeSerieNaUsina,
  inserirEquipamentoDaUsina, inserirUsina, listarEquipamentosDaUsina, listarUsinas, marcarUsinaComoDesativada, type CampoDeReferencia, type DadosDaUsina,
  type DadosDoEquipamento, type EquipamentoDaUsina, type MudancaDoEquipamento, type ReferenciaInexistente, type UsinaDoBanco, type UsinaTravada,
} from '../repositories/usinasRepository.ts';
import { calcularRegime, calcularVencimento, conferirDatasDaUsina, conferirGarantiaDeDesempenho, conferirVencimentosDasGarantias, type CamposInvalidos } from './regrasDaUsina.ts';

// Cada registro é um equipamento físico, com a própria série: garantias, manutenções e futuras
// substituições precisam identificar o item individualmente.
const QUANTIDADE_DE_CADA_EQUIPAMENTO = 1;
// Mesma mensagem na conferência prévia e na recusa do banco.
const MENSAGEM_DA_REFERENCIA: Record<CampoDeReferencia, string> = {
  clienteId: 'Cliente não encontrado.',
  codigoIbge: 'Município não encontrado.',
};

// Mesmo formato de erro da validação: a tela mostra a mensagem junto do campo.
function entradaInvalida(campos: CamposInvalidos): ErroHttp {
  return new ErroHttp(400, 'ENTRADA_INVALIDA', 'Dados inválidos. Confira os campos.', campos);
}

// Recebe as conferências já reunidas: a resposta traz todos os campos recusados de uma vez.
function exigirCamposValidos(campos: CamposInvalidos): void {
  if (Object.keys(campos).length > 0) throw entradaInvalida(campos);
}

// A recusa do banco vira o mesmo erro de campo da conferência prévia.
function recusaDaReferencia({ campoInexistente }: ReferenciaInexistente): ErroHttp {
  return entradaInvalida({ [campoInexistente]: MENSAGEM_DA_REFERENCIA[campoInexistente] });
}

// Mesmo 404 em detalhe, alteração, desativação e equipamentos.
function usinaNaoEncontrada(): ErroHttp {
  return new ErroHttp(404, 'USINA_NAO_ENCONTRADA', 'Usina não encontrada.');
}

// Vencimentos são calculados a cada resposta, a partir da instalação: o banco não os grava.
function comoEquipamentoDaApi(equipamento: EquipamentoDaUsina) {
  const { garantiaDesempenhoAnos } = equipamento;
  return {
    ...equipamento,
    vencimentoGarantiaProduto: calcularVencimento(equipamento.dataInstalacao, equipamento.garantiaProdutoMeses),
    vencimentoGarantiaDesempenho: garantiaDesempenhoAnos === null ? null : calcularVencimento(equipamento.dataInstalacao, garantiaDesempenhoAnos * 12),
  };
}

// O regime também é calculado na leitura: não existe coluna de regime. kWp sai como número, o formato do contrato.
function comoUsinaDaLista(usina: UsinaDoBanco) {
  const { id, clienteId, clienteNome, municipio, dataProtocolo, dataConexao, intervaloLimpezaMeses, status } = usina;
  return { id, clienteId, clienteNome, municipio, kwp: usina.kwp.toNumber(), regime: calcularRegime(dataProtocolo), dataProtocolo, dataConexao, intervaloLimpezaMeses, status };
}

// Quem chama pede só as ativas: a usina desativada sai das listas, mas o detalhe continua disponível.
export async function buscarUsinasAtivas({ busca, pagina, porPagina }: { busca?: string; pagina: number; porPagina: number }) {
  const { usinas, total } = await listarUsinas({ status: 'ativa', busca, pagina, porPagina });
  return { usinas: usinas.map(comoUsinaDaLista), pagina, porPagina, total };
}

// Só leitura: o município é do núcleo, e o módulo não grava nele.
export async function buscarMunicipiosParaUsina(filtro: { busca: string; uf?: string }) {
  return buscarMunicipiosPorNome(filtro);
}

// Base de todas as respostas de usina. Não filtra por status: a usina desativada continua consultável.
export async function consultarUsina(id: number) {
  const usina = await buscarUsinaPorId(id);
  if (!usina) throw usinaNaoEncontrada();
  const { id: idDaUsina, clienteId, clienteNome, ...resto } = comoUsinaDaLista(usina);
  const equipamentos = await listarEquipamentosDaUsina(id);
  return { id: idDaUsina, cliente: { id: clienteId, nome: clienteNome }, ...resto, equipamentos: equipamentos.map(comoEquipamentoDaApi) };
}

// Confere só o que veio no pedido: campo ausente no PATCH não é consultado. As duas recusas podem vir juntas.
async function conferirReferencias({ clienteId, codigoIbge }: Partial<DadosDaUsina>): Promise<CamposInvalidos> {
  const [cliente, municipio] = await Promise.all([
    clienteId === undefined ? true : buscarClientePorId(clienteId),
    codigoIbge === undefined ? true : buscarMunicipio(codigoIbge),
  ]);
  return {
    ...(!cliente && { clienteId: MENSAGEM_DA_REFERENCIA.clienteId }),
    ...(!municipio && { codigoIbge: MENSAGEM_DA_REFERENCIA.codigoIbge }),
  };
}

// Cliente e município precisam existir; a recusa do banco cobre o caso de sumirem depois da conferência.
export async function cadastrarUsina(dados: DadosDaUsina) {
  exigirCamposValidos({ ...conferirDatasDaUsina(dados.dataProtocolo, dados.dataConexao), ...(await conferirReferencias(dados)) });
  const resultado = await inserirUsina(dados);
  if (typeof resultado !== 'number') throw recusaDaReferencia(resultado);
  return consultarUsina(resultado);
}

// Alteração de usina e gravação de equipamento passam por aqui; usina inexistente responde 404 antes das demais conferências.
function naUsinaTravada<Resultado>(id: number, acao: (usina: UsinaTravada, transacao: Knex.Transaction) => Promise<Resultado>): Promise<Resultado> {
  return comUsinaTravada(id, async (usina, transacao) => {
    if (!usina) throw usinaNaoEncontrada();
    return acao(usina, transacao);
  });
}

// Só status e atualizado_em de usinas ativas mudam; equipamentos, manutenções e alertas ficam como estão.
export async function desativarUsina(id: number) {
  await marcarUsinaComoDesativada(id);
  return consultarUsina(id);
}

// As referências são lidas antes de travar a usina, para não segurar a linha esperando outra conexão do pool.
export async function alterarUsina(id: number, mudanca: Partial<DadosDaUsina>) {
  const camposDeReferencia = await conferirReferencias(mudanca);
  await naUsinaTravada(id, async (usina, transacao) => {
    exigirCamposValidos({
      ...camposDeReferencia,
      ...conferirDatasDaUsina(mudanca.dataProtocolo ?? usina.dataProtocolo, mudanca.dataConexao ?? usina.dataConexao),
    });
    const recusa = await atualizarUsina(transacao, id, mudanca);
    if (recusa) throw recusaDaReferencia(recusa);
  });
  return consultarUsina(id);
}

// Série ausente no PATCH não é conferida; a repetição só é recusada dentro da mesma usina.
async function conferirSerie(transacao: Knex.Transaction, usinaId: number, numeroSerie: string | undefined, equipamentoIgnorado?: number): Promise<CamposInvalidos> {
  if (numeroSerie === undefined) return {};
  const repetida = await existeSerieNaUsina(transacao, usinaId, numeroSerie, equipamentoIgnorado);
  return repetida ? { numeroSerie: 'Já existe um equipamento com este número de série nesta usina.' } : {};
}

// A trava da usina impede que dois pedidos simultâneos gravem a mesma série: não há índice único para isso no banco.
export async function cadastrarEquipamentoDaUsina(usinaId: number, dados: Omit<DadosDoEquipamento, 'quantidade'>) {
  const equipamento = await naUsinaTravada(usinaId, async (_usina, transacao) => {
    // Nos dois cadastros, a recusa pelo tipo vem depois para prevalecer sobre a do vencimento no mesmo campo.
    exigirCamposValidos({
      ...conferirVencimentosDasGarantias(dados.dataInstalacao, dados.garantiaProdutoMeses, dados.garantiaDesempenhoAnos),
      ...conferirGarantiaDeDesempenho(dados.tipo, dados.garantiaDesempenhoAnos),
      ...(await conferirSerie(transacao, usinaId, dados.numeroSerie)),
    });
    return inserirEquipamentoDaUsina(transacao, usinaId, { ...dados, quantidade: QUANTIDADE_DE_CADA_EQUIPAMENTO });
  });
  return comoEquipamentoDaApi(equipamento);
}

// Combina o pedido com os valores atuais: um PATCH parcial pode invalidar o que já estava salvo.
export async function alterarEquipamentoDaUsina(usinaId: number, equipamentoId: number, mudanca: MudancaDoEquipamento) {
  const equipamento = await naUsinaTravada(usinaId, async (_usina, transacao) => {
    const atual = await buscarEquipamentoDaUsina(transacao, usinaId, equipamentoId);
    if (!atual) throw new ErroHttp(404, 'EQUIPAMENTO_DA_USINA_NAO_ENCONTRADO', 'Equipamento não encontrado nesta usina.');
    // Com ??, o null que limpa a garantia voltaria ao valor antigo.
    const garantiaFinal = mudanca.garantiaDesempenhoAnos === undefined ? atual.garantiaDesempenhoAnos : mudanca.garantiaDesempenhoAnos;
    exigirCamposValidos({
      ...conferirVencimentosDasGarantias(mudanca.dataInstalacao ?? atual.dataInstalacao, mudanca.garantiaProdutoMeses ?? atual.garantiaProdutoMeses, garantiaFinal),
      ...conferirGarantiaDeDesempenho(mudanca.tipo ?? atual.tipo, garantiaFinal),
      ...(await conferirSerie(transacao, usinaId, mudanca.numeroSerie, equipamentoId)),
    });
    return atualizarEquipamentoDaUsina(transacao, usinaId, equipamentoId, mudanca);
  });
  return comoEquipamentoDaApi(equipamento);
}
