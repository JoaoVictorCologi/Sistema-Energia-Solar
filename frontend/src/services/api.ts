// Todas as chamadas ao backend. Contrato em docs/arquitetura/backend.md.

export type Papel = 'admin' | 'usuario';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
}

interface CorpoDeErro {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
}

// Erro no formato padrão do backend: { error: { code, message, fields? } }.
export class ErroDaApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly campos: Record<string, string>;

  constructor(status: number, codigo: string, mensagem: string, campos: Record<string, string> = {}) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

// O cookie de sessão vai sozinho: em desenvolvimento o Vite repassa /api ao backend na mesma origem.
export async function requisitar<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch('/api' + caminho, {
      method: opcoes.metodo ?? 'GET',
      headers: opcoes.corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    });
  } catch {
    throw new ErroDaApi(0, 'SEM_CONEXAO', 'Não foi possível falar com o servidor. Confira a conexão e tente de novo.');
  }

  if (resposta.status === 204) return undefined as T;
  const dados: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = (dados as CorpoDeErro | null)?.error;
    throw new ErroDaApi(
      resposta.status,
      erro?.code ?? 'ERRO_INTERNO',
      erro?.message ?? 'Algo deu errado. Tente de novo em instantes.',
      erro?.fields,
    );
  }
  return dados as T;
}

export async function entrar(email: string, senha: string): Promise<Usuario> {
  const { usuario } = await requisitar<{ usuario: Usuario }>('/auth/login', { metodo: 'POST', corpo: { email, senha } });
  return usuario;
}

export async function sair(): Promise<void> {
  await requisitar<void>('/auth/logout', { metodo: 'POST' });
}

// Sem sessão válida (401), devolve null em vez de erro: é o caso normal de quem ainda não entrou.
export async function buscarUsuarioLogado(): Promise<Usuario | null> {
  try {
    const { usuario } = await requisitar<{ usuario: Usuario }>('/auth/me');
    return usuario;
  } catch (erro) {
    if (erro instanceof ErroDaApi && erro.status === 401) return null;
    throw erro;
  }
}

// ── Simulação pública (tarefas 9 e 12) ──

export type TipoLigacao = 'monofasico' | 'bifasico' | 'trifasico';
export type Subgrupo = 'B1' | 'B2' | 'B3';

export interface OpcaoDeDistribuidora {
  cnpj: string;
  sigla: string;
  // A de mais conjuntos no município; só vem marcada quando há mais de uma.
  sugerida: boolean;
}

// Plano 5: qualquer município do Brasil. Uma distribuidora: escolha automática; várias: o visitante escolhe;
// nenhuma: atendido = false.
export interface LocalDoCep {
  cep: string;
  cidade: string;
  uf: string;
  atendido: boolean;
  distribuidoras: OpcaoDeDistribuidora[];
  escolhaNecessaria: boolean;
}

export interface MesDoPrimeiroAno {
  anoCivil: number;
  mes: number;
  consumoKwh: number;
  geracaoKwh: number;
  faturaSemSolar: number;
  faturaComSolar: number;
  economia: number;
}

export interface AlertaDaSimulacao {
  codigo: string;
  mensagem: string;
}

// Números já arredondados pelo backend; o frontend só exibe.
export interface Simulacao {
  codigo: string;
  local: { cidade: string; uf: string };
  pedido: { tipoLigacao: TipoLigacao; subgrupo: Subgrupo; consumoMedioKwh: number };
  dimensionamento: { numeroModulos: number; potenciaModuloW: number; kwpInstalado: number; inversorKw: number | null };
  investimentoEstimado: { valor: number; aviso: string };
  indicadores: {
    economiaPrimeiroAno: number;
    economiaMensalMedia: number;
    economiaTotal: number;
    vpl: number;
    tir: number | null;
    paybackSimplesAnos: number | null;
    paybackDescontadoAnos: number | null;
  };
  primeiroAno: MesDoPrimeiroAno[];
  resumoAnual: { ano: number; geracaoKwh: number; economia: number; fluxoDeCaixa: number; fluxoAcumulado: number }[];
  premissas: {
    distribuidora: string;
    vigenciaDaTarifa: { inicio: string; fim: string };
    tarifaSemImpostos: { te: number; tusd: number; fioB: number };
    tarifaComImpostos: number;
    tributos: { icms: number; pis: number; cofins: number };
    hspMedio: number;
    performanceRatio: number;
    simultaneidade: number;
    consumoMinimoKwh: number;
    reajusteAnual: number;
    taxaDesconto: number;
    inicio: { ano: number; mes: number };
    regime: string;
    versaoParametros: string;
  };
  alertas: AlertaDaSimulacao[];
}

export interface PedidoDeSimulacao {
  cep: string;
  tipoLigacao: TipoLigacao;
  subgrupo: Subgrupo;
  consumoMedioKwh: number;
  // CNPJ de uma das opções do CEP; obrigatório quando há mais de uma.
  distribuidora?: string;
}

export interface PedidoDeProposta {
  simulacao: string;
  nome: string;
  email: string;
  telefone: string;
  aceite: boolean;
}

export async function consultarCep(cep: string): Promise<LocalDoCep> {
  return requisitar<LocalDoCep>(`/cep/${cep}`);
}

export async function simular(pedido: PedidoDeSimulacao): Promise<Simulacao> {
  const { simulacao } = await requisitar<{ simulacao: Simulacao }>('/simulacoes', { metodo: 'POST', corpo: pedido });
  return simulacao;
}

// Devolve só a mensagem de confirmação: a API não devolve dados de cliente.
export async function pedirProposta(pedido: PedidoDeProposta): Promise<string> {
  const { mensagem } = await requisitar<{ mensagem: string }>('/clientes', { metodo: 'POST', corpo: pedido });
  return mensagem;
}

// ── Área restrita (tarefas 13 a 15) ──

export type StatusDaProposta = 'enviada' | 'aceita' | 'recusada';
export type TipoDeEquipamento = 'modulo' | 'inversor';

export interface Pagina {
  pagina: number;
  porPagina: number;
  total: number;
}

export interface ResumoDaImportacao {
  status: StatusDaImportacao;
  finalizadaEm: string | null;
}

export interface Painel {
  clientes: number;
  simulacoes: number;
  simulacoesComPedido: number;
  propostasPorStatus: Record<StatusDaProposta, number>;
  ultimaImportacaoDeTarifas: ResumoDaImportacao | null;
}

export interface ClienteDaLista {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  criadoEm: string;
}

export interface SimulacaoDoCliente {
  codigo: string;
  criadaEm: string;
  cidade: string;
  tipoLigacao: TipoLigacao;
  consumoMedioKwh: number;
  kwpInstalado: number;
  investimentoEstimado: number;
  economiaMensalMedia: number;
}

export interface PropostaResumida {
  id: number;
  status: StatusDaProposta;
  investimento: number;
  validaAte: string;
  vencida: boolean;
  criadoEm: string;
}

export interface PropostaDaLista extends PropostaResumida {
  clienteId: number;
  clienteNome: string;
}

export interface DetalheDoCliente {
  cliente: ClienteDaLista & { cep: string; aceiteEm: string };
  simulacoes: SimulacaoDoCliente[];
  propostas: PropostaResumida[];
}

export interface Equipamento {
  id: number;
  tipo: TipoDeEquipamento;
  fabricante: string;
  modelo: string;
  potenciaW: number;
  degradacaoAnual: number | null;
  preco: number;
  ativo: boolean;
}

export interface NovoEquipamento {
  tipo: TipoDeEquipamento;
  fabricante: string;
  modelo: string;
  potenciaW: number;
  degradacaoAnual?: number;
  preco: number;
}

// Snapshot da proposta: os mesmos blocos da simulação pública, sem o investimento estimado. Só leitura.
export interface Proposta extends Omit<Simulacao, 'codigo' | 'investimentoEstimado'> {
  id: number;
  clienteId: number;
  status: StatusDaProposta;
  investimento: number;
  validaAte: string;
  criadaEm: string;
  emitidaEm: string;
  cliente: { nome: string; email: string; telefone: string; cep: string };
  equipamentos: { modulo: Equipamento & { quantidade: number }; inversor: Equipamento & { quantidade: number } };
  precos: { modulos: number; inversor: number; instalacao: number; margem: number; investimento: number };
}

export type StatusDaImportacao = 'executando' | 'sucesso' | 'sem_alteracao' | 'erro';

export interface ExecucaoDeImportacao {
  id: number;
  status: StatusDaImportacao;
  iniciadaEm: string;
  finalizadaEm: string | null;
  linhasGravadas: number | null;
  mensagem: string | null;
}

export interface Importacao {
  tipo: string;
  descricao: string;
  agenda: string;
  ultimaExecucao: ExecucaoDeImportacao | null;
  ultimoSucessoEm: string | null;
  desatualizada: boolean;
}

function consulta(parametros: Record<string, string | number | undefined>): string {
  const texto = new URLSearchParams(
    Object.entries(parametros).filter(([, valor]) => valor !== undefined && valor !== '').map(([chave, valor]) => [chave, String(valor)]),
  ).toString();
  return texto ? `?${texto}` : '';
}

export async function buscarPainel(): Promise<Painel> {
  return (await requisitar<{ painel: Painel }>('/admin/painel')).painel;
}

export async function listarClientes(filtro: { busca?: string; pagina: number }): Promise<Pagina & { clientes: ClienteDaLista[] }> {
  return requisitar(`/admin/clientes${consulta(filtro)}`);
}

export async function buscarCliente(id: number): Promise<DetalheDoCliente> {
  return requisitar(`/admin/clientes/${id}`);
}

export async function listarEquipamentos(tipo?: TipoDeEquipamento): Promise<Equipamento[]> {
  return (await requisitar<{ equipamentos: Equipamento[] }>(`/admin/equipamentos${consulta({ tipo })}`)).equipamentos;
}

export async function cadastrarEquipamento(novo: NovoEquipamento): Promise<Equipamento> {
  return (await requisitar<{ equipamento: Equipamento }>('/admin/equipamentos', { metodo: 'POST', corpo: novo })).equipamento;
}

export async function alterarEquipamento(id: number, mudanca: { preco?: number; ativo?: boolean }): Promise<Equipamento> {
  return (await requisitar<{ equipamento: Equipamento }>(`/admin/equipamentos/${id}`, { metodo: 'PATCH', corpo: mudanca })).equipamento;
}

// Envia só a escolha dos equipamentos: o preço é calculado no backend (regra 6 do AGENTS.md).
export async function gerarProposta(pedido: { simulacao: string; moduloId: number; inversorId: number }): Promise<Proposta> {
  return (await requisitar<{ proposta: Proposta }>('/admin/propostas', { metodo: 'POST', corpo: pedido })).proposta;
}

export async function listarPropostas(filtro: { status?: StatusDaProposta; pagina: number }): Promise<Pagina & { propostas: PropostaDaLista[] }> {
  return requisitar(`/admin/propostas${consulta(filtro)}`);
}

export async function buscarProposta(id: number): Promise<Proposta> {
  return (await requisitar<{ proposta: Proposta }>(`/admin/propostas/${id}`)).proposta;
}

export async function mudarStatusDaProposta(id: number, status: StatusDaProposta): Promise<Proposta> {
  return (await requisitar<{ proposta: Proposta }>(`/admin/propostas/${id}/status`, { metodo: 'PATCH', corpo: { status } })).proposta;
}

export async function listarImportacoes(): Promise<Importacao[]> {
  return (await requisitar<{ importacoes: Importacao[] }>('/admin/importacoes')).importacoes;
}

// Responde só quando a importação termina (pode levar alguns segundos).
export async function rodarImportacao(tipo: string): Promise<ExecucaoDeImportacao> {
  return (await requisitar<{ importacao: ExecucaoDeImportacao }>(`/admin/importacoes/${tipo}`, { metodo: 'POST' })).importacao;
}
