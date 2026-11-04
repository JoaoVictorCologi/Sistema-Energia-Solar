// Camada de acesso à API: todas as chamadas ao backend e os tipos das respostas.
// As rotas são definidas em backend/src/routes.

export type Papel = 'admin' | 'gestor' | 'operador';

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

// O cookie de sessão é enviado pelo navegador. Em desenvolvimento, o proxy do Vite mantém site e API na mesma origem.
async function requisitar<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
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

// ── Sessão ──

export async function entrar(email: string, senha: string): Promise<Usuario> {
  const { usuario } = await requisitar<{ usuario: Usuario }>('/auth/login', { metodo: 'POST', corpo: { email, senha } });
  return usuario;
}

export async function sair(): Promise<void> {
  await requisitar<void>('/auth/logout', { metodo: 'POST' });
}

// Sem sessão válida (401), devolve null em vez de lançar erro: é a situação normal de quem ainda não entrou.
export async function buscarUsuarioLogado(): Promise<Usuario | null> {
  try {
    const { usuario } = await requisitar<{ usuario: Usuario }>('/auth/me');
    return usuario;
  } catch (erro) {
    if (erro instanceof ErroDaApi && erro.status === 401) return null;
    throw erro;
  }
}

// ── Simulação pública ──

export type TipoLigacao = 'monofasico' | 'bifasico' | 'trifasico';
export type Subgrupo = 'B1' | 'B2' | 'B3';

export interface OpcaoDeDistribuidora {
  cnpj: string;
  sigla: string;
  // Distribuidora com mais conjuntos no município; indicada apenas quando há mais de uma opção.
  sugerida: boolean;
}

// Cobertura nacional: com uma distribuidora, a escolha é automática; com várias, o visitante escolhe;
// sem nenhuma, `atendido` é false.
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

export type OrigemDaPremissa = 'informado' | 'estimado' | 'revisado';
export type TipoDePagamento = 'avista' | 'parcelado' | 'financiado';
export type PerfilDeConsumo = 'noite' | 'equilibrado' | 'dia';
export type HorasDeSol = 'diaTodo' | 'de6a8' | 'de4a6' | 'menosDe4';
export type Orientacao = 'norte' | 'nordeste' | 'noroeste' | 'leste' | 'oeste' | 'sudeste' | 'sudoeste' | 'sul' | 'plano';
export type Inclinacao = 'plano' | 'pouca' | 'media' | 'muita';
export type TipoDeTelhado = 'ceramica' | 'metalico' | 'fibrocimento' | 'laje' | 'solo';

export interface ParcelaEstimada {
  forma: string;
  tipo: TipoDePagamento;
  parcelas: number;
  entrada: number;
  taxaMensal: number;
  valorParcela: number;
}

// Valores já arredondados pelo backend; o frontend apenas os exibe.
export interface Simulacao {
  codigo: string;
  local: { cidade: string; uf: string };
  pedido: { tipoLigacao: TipoLigacao; subgrupo: Subgrupo; consumoMedioKwh: number };
  dimensionamento: { numeroModulos: number; potenciaModuloW: number; kwpInstalado: number; inversorKw: number | null };
  investimentoEstimado: { valor: number; aviso: string };
  // Geração do 1º ano ÷ consumo do ano. Fica abaixo de 1 quando a área do telhado ou o limite de ampliação restringem o sistema.
  coberturaAlcancada: number;
  parcelaEstimada: ParcelaEstimada | null;
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
    // Ausentes em orçamentos gravados antes destas premissas existirem.
    origem?: { performanceRatio: OrigemDaPremissa; simultaneidade: OrigemDaPremissa; tributos: OrigemDaPremissa; telhado: OrigemDaPremissa; consumoMensal: OrigemDaPremissa };
    telhado?: { fator: number };
  };
  alertas: AlertaDaSimulacao[];
}

// Perguntas opcionais do simulador. Campo ausente equivale a "não sei", e o cálculo usa o valor típico.
export interface RespostasDoRefinamento {
  conta?: { valorReais: number; consumoKwh: number; iluminacaoPublicaReais?: number };
  consumoMensalKwh?: number[];
  perfilDeConsumo?: PerfilDeConsumo;
  telhado?: { horasDeSol?: HorasDeSol; orientacao?: Orientacao; inclinacao?: Inclinacao; tipo?: TipoDeTelhado; areaM2?: number };
  solarExistente?: { protocoloEm: string };
  aumentoPrevistoKwh?: number;
  pagamentoPreferido?: TipoDePagamento;
}

export interface PedidoDeSimulacao extends RespostasDoRefinamento {
  cep: string;
  tipoLigacao: TipoLigacao;
  subgrupo: Subgrupo;
  consumoMedioKwh: number;
  // CNPJ de uma das opções do CEP; obrigatório quando há mais de uma.
  distribuidora?: string;
}

export type ContatoPreferido = 'whatsapp' | 'telefone' | 'email';
export type MelhorHorario = 'manha' | 'tarde' | 'noite';

export interface PedidoDeProposta {
  simulacao: string;
  nome: string;
  email: string;
  telefone: string;
  aceite: boolean;
  endereco?: { logradouro: string; numero?: string; complemento?: string; bairro?: string };
  contatoPreferido?: ContatoPreferido;
  melhorHorario?: MelhorHorario;
  // Consentimento separado do aceite da proposta (LGPD).
  autorizaUsoParaCalibracao?: boolean;
}

export async function consultarCep(cep: string): Promise<LocalDoCep> {
  return requisitar<LocalDoCep>(`/cep/${cep}`);
}

export async function simular(pedido: PedidoDeSimulacao): Promise<Simulacao> {
  const { simulacao } = await requisitar<{ simulacao: Simulacao }>('/simulacoes', { metodo: 'POST', corpo: pedido });
  return simulacao;
}

export async function listarFormasPublicas(): Promise<{ nome: string; tipo: TipoDePagamento }[]> {
  return (await requisitar<{ formas: { nome: string; tipo: TipoDePagamento }[] }>('/formas-pagamento')).formas;
}

// Devolve apenas a mensagem de confirmação: a API não retorna dados do cliente.
export async function pedirProposta(pedido: PedidoDeProposta): Promise<string> {
  const { mensagem } = await requisitar<{ mensagem: string }>('/clientes', { metodo: 'POST', corpo: pedido });
  return mensagem;
}

// ── Área restrita ──

export type StatusDaProposta = 'rascunho' | 'enviada' | 'aceita' | 'recusada';
// Vencida não é um status gravado: é uma proposta enviada com a validade passada. Existe apenas como filtro da lista.
export type FiltroDeStatus = StatusDaProposta | 'vencida';
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
  // Pedidos que ainda não viraram orçamento.
  pedidosNovos: number;
  // `enviada` inclui as vencidas.
  propostasPorStatus: Record<StatusDaProposta, number>;
  propostasVencidas: number;
  valorAceitoNoMes: number;
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
  distribuidora?: string;
  // O pedido como o cliente enviou. Os números do JSON gravado podem chegar como texto.
  respostas: RespostasGravadas | null;
}

export interface RespostasGravadas {
  conta?: { valorReais: number | string; consumoKwh: number | string; iluminacaoPublicaReais?: number | string };
  consumoMensalKwh?: (number | string)[];
  perfilDeConsumo?: PerfilDeConsumo;
  telhado?: { horasDeSol?: HorasDeSol; orientacao?: Orientacao; inclinacao?: Inclinacao; tipo?: TipoDeTelhado; areaM2?: number | string };
  solarExistente?: { protocoloEm: string };
  aumentoPrevistoKwh?: number | string;
  pagamentoPreferido?: TipoDePagamento;
}

export interface SimulacaoDaLista {
  codigo: string;
  criadaEm: string;
  cidade: string;
  uf: string;
  distribuidora: string;
  tipoLigacao: TipoLigacao;
  consumoMedioKwh: number;
  kwpInstalado: number;
  investimentoEstimado: number;
  economiaMensalMedia: number;
  cliente: { id: number; nome: string } | null;
}

export interface FiltroDeSimulacoes {
  de?: string;
  ate?: string;
  cidade?: string;
  comPedido?: 'true' | 'false';
  pagina: number;
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
  versao: number;
}

export interface DetalheDoCliente {
  cliente: ClienteDaLista & {
    cep: string;
    aceiteEm: string;
    contatoPreferido: ContatoPreferido | null;
    melhorHorario: MelhorHorario | null;
    autorizaUsoParaCalibracao: boolean;
    endereco: { logradouro: string; numero: string | null; complemento: string | null; bairro: string | null } | null;
  };
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

export interface RevisaoDePremissas {
  performanceRatio?: number;
  simultaneidade?: number;
  telhado?: { horasDeSol?: HorasDeSol; orientacao?: Orientacao; inclinacao?: Inclinacao };
  quantidadeDeModulos?: number;
}

export interface AjusteDaProposta {
  id: number;
  tipo: 'desconto' | 'acrescimo';
  descricao: string;
  modo: 'valor' | 'percentual';
  valor: number;
  justificativa: string | null;
  // Negativo nos descontos.
  valorEmReais: number;
}

export interface CondicaoDaProposta {
  id: number;
  formaPagamentoId: number;
  nome: string;
  tipo: TipoDePagamento;
  taxaMensal: number;
  parcelas: number;
  carenciaDias: number;
  entrada: number;
  valorParcela: number;
  valorTotal: number;
  // null nas condições à vista.
  economiaMensalMenosParcela: number | null;
}

export interface EventoDaProposta {
  tipo: string;
  descricao: string;
  justificativa: string | null;
  usuario: string | null;
  criadoEm: string;
}

export interface VersaoDaProposta {
  id: number;
  versao: number;
  status: StatusDaProposta;
  investimento: number;
  validaAte: string;
  criadoEm: string;
}

// Leitura do snapshot gravado: os mesmos blocos da simulação pública, sem a estimativa de investimento e de parcela.
// Orçamentos antigos reabrem como foram gravados, por isso os campos mais recentes do snapshot são opcionais.
export interface Proposta extends Omit<Simulacao, 'codigo' | 'investimentoEstimado' | 'parcelaEstimada' | 'coberturaAlcancada'> {
  id: number;
  clienteId: number;
  status: StatusDaProposta;
  vencida: boolean;
  versao: number;
  propostaRaizId: number | null;
  observacoes: string | null;
  escolhas: { moduloId: number; inversorId: number; revisao?: RevisaoDePremissas };
  investimento: number;
  validaAte: string;
  criadaEm: string;
  emitidaEm: string;
  cliente: { nome: string; email: string; telefone: string; cep: string };
  equipamentos: { modulo: Equipamento & { quantidade: number }; inversor: Equipamento & { quantidade: number } };
  precos: { modulos: number; inversor: number; instalacao: number; margem: number; calculado?: number; ajustes?: number; investimento: number };
  ajustes?: AjusteDaProposta[];
  condicoes?: CondicaoDaProposta[];
  coberturaAlcancada?: number;
  estimadoPeloSimulador?: { investimento: number | null; economiaMensalMedia: number | null; paybackSimplesAnos: number | null; kwpInstalado: number | null };
  configuracaoUsada?: { margem: number; instalacaoPorKwp: number; validadeDias: number; limiteDesconto: number };
  historico: EventoDaProposta[];
  versoes: VersaoDaProposta[];
}

export interface EdicaoDoRascunho {
  moduloId?: number;
  inversorId?: number;
  revisao?: RevisaoDePremissas;
  justificativa?: string;
  observacoes?: string | null;
}

export interface NovoAjuste {
  tipo: 'desconto' | 'acrescimo';
  descricao: string;
  modo: 'valor' | 'percentual';
  valor: number;
  justificativa?: string;
}

export interface NovaCondicao {
  formaPagamentoId: number;
  entrada?: number;
  parcelas?: number;
  carenciaDias?: number;
}

export interface ConfiguracaoComercial {
  margem: number;
  instalacaoPorKwp: number;
  custoReferenciaPorKwp: number;
  validadeDias: number;
  limiteDesconto: number;
  alteradoEm: string;
}

export interface FormaDePagamento {
  id: number;
  tipo: TipoDePagamento;
  nome: string;
  taxaMensal: number | null;
  parcelasMinimas: number;
  parcelasMaximas: number;
  entradaMinima: number;
  carenciaMaximaDias: number;
  descontoAvista: number;
  ativa: boolean;
}

export type DadosDaForma = Omit<FormaDePagamento, 'id' | 'tipo'>;

export interface UsuarioDaEquipe extends Usuario {
  criadoEm: string;
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

// Monta a query string, omitindo os filtros vazios.
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

export async function listarSimulacoes(filtro: FiltroDeSimulacoes): Promise<Pagina & { simulacoes: SimulacaoDaLista[] }> {
  return requisitar(`/admin/simulacoes${consulta({ ...filtro })}`);
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

// Envia apenas a escolha dos equipamentos: o preço é calculado no backend.
export async function gerarProposta(pedido: { simulacao: string; moduloId: number; inversorId: number }): Promise<Proposta> {
  return (await requisitar<{ proposta: Proposta }>('/admin/propostas', { metodo: 'POST', corpo: pedido })).proposta;
}

export async function listarPropostas(filtro: { status?: FiltroDeStatus; pagina: number }): Promise<Pagina & { propostas: PropostaDaLista[] }> {
  return requisitar(`/admin/propostas${consulta(filtro)}`);
}

export async function buscarProposta(id: number): Promise<Proposta> {
  return (await requisitar<{ proposta: Proposta }>(`/admin/propostas/${id}`)).proposta;
}

// Toda alteração de orçamento devolve o orçamento completo, já recalculado pelo backend.
async function alterarProposta(caminho: string, metodo: string, corpo?: unknown): Promise<Proposta> {
  return (await requisitar<{ proposta: Proposta }>(`/admin/propostas/${caminho}`, { metodo, corpo })).proposta;
}

export const mudarStatusDaProposta = (id: number, status: Exclude<StatusDaProposta, 'rascunho'>) => alterarProposta(`${id}/status`, 'PATCH', { status });
export const editarProposta = (id: number, edicao: EdicaoDoRascunho) => alterarProposta(String(id), 'PATCH', edicao);
export const adicionarAjuste = (id: number, ajuste: NovoAjuste) => alterarProposta(`${id}/ajustes`, 'POST', ajuste);
export const removerAjuste = (id: number, itemId: number) => alterarProposta(`${id}/ajustes/${itemId}`, 'DELETE');
export const adicionarCondicao = (id: number, condicao: NovaCondicao) => alterarProposta(`${id}/condicoes`, 'POST', condicao);
export const removerCondicao = (id: number, itemId: number) => alterarProposta(`${id}/condicoes/${itemId}`, 'DELETE');
export const enviarProposta = (id: number) => alterarProposta(`${id}/enviar`, 'POST');
export const criarNovaVersao = (id: number) => alterarProposta(`${id}/nova-versao`, 'POST', {});
export const duplicarProposta = (id: number) => alterarProposta(`${id}/duplicar`, 'POST', {});

export async function excluirProposta(id: number): Promise<void> {
  await requisitar<void>(`/admin/propostas/${id}`, { metodo: 'DELETE' });
}

export async function buscarConfiguracao(): Promise<ConfiguracaoComercial> {
  return (await requisitar<{ configuracao: ConfiguracaoComercial }>('/admin/configuracoes-comerciais')).configuracao;
}

export async function alterarConfiguracao(mudanca: Partial<Omit<ConfiguracaoComercial, 'alteradoEm'>>): Promise<ConfiguracaoComercial> {
  return (await requisitar<{ configuracao: ConfiguracaoComercial }>('/admin/configuracoes-comerciais', { metodo: 'PATCH', corpo: mudanca })).configuracao;
}

export async function listarFormas(): Promise<FormaDePagamento[]> {
  return (await requisitar<{ formas: FormaDePagamento[] }>('/admin/formas-pagamento')).formas;
}

export async function cadastrarForma(nova: DadosDaForma & { tipo: TipoDePagamento }): Promise<FormaDePagamento> {
  return (await requisitar<{ forma: FormaDePagamento }>('/admin/formas-pagamento', { metodo: 'POST', corpo: nova })).forma;
}

export async function alterarForma(id: number, mudanca: Partial<DadosDaForma>): Promise<FormaDePagamento> {
  return (await requisitar<{ forma: FormaDePagamento }>(`/admin/formas-pagamento/${id}`, { metodo: 'PATCH', corpo: mudanca })).forma;
}

export async function listarUsuarios(): Promise<UsuarioDaEquipe[]> {
  return (await requisitar<{ usuarios: UsuarioDaEquipe[] }>('/admin/usuarios')).usuarios;
}

export async function cadastrarUsuario(novo: { nome: string; email: string; senha: string; papel: Exclude<Papel, 'admin'> }): Promise<Usuario> {
  return (await requisitar<{ usuario: Usuario }>('/admin/usuarios', { metodo: 'POST', corpo: novo })).usuario;
}

export async function alterarUsuario(id: number, mudanca: { nome?: string; email?: string; papel?: Exclude<Papel, 'admin'> }): Promise<Usuario> {
  return (await requisitar<{ usuario: Usuario }>(`/admin/usuarios/${id}`, { metodo: 'PATCH', corpo: mudanca })).usuario;
}

export async function redefinirSenha(id: number, senha: string): Promise<void> {
  await requisitar<void>(`/admin/usuarios/${id}/senha`, { metodo: 'POST', corpo: { senha } });
}

export async function excluirUsuario(id: number): Promise<void> {
  await requisitar<void>(`/admin/usuarios/${id}`, { metodo: 'DELETE' });
}

export async function listarImportacoes(): Promise<Importacao[]> {
  return (await requisitar<{ importacoes: Importacao[] }>('/admin/importacoes')).importacoes;
}

// Responde apenas quando a importação termina, o que pode levar alguns segundos.
export async function rodarImportacao(tipo: string): Promise<ExecucaoDeImportacao> {
  return (await requisitar<{ importacao: ExecucaoDeImportacao }>(`/admin/importacoes/${tipo}`, { metodo: 'POST' })).importacao;
}
