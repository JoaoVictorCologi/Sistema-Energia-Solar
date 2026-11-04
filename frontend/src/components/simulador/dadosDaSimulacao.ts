import type { HorasDeSol, Inclinacao, LocalDoCep, Orientacao, PedidoDeSimulacao, PerfilDeConsumo, Simulacao, Subgrupo, TipoDePagamento, TipoDeTelhado, TipoLigacao } from '../../services/api.ts';
import { lerNumero, lerNumeroOpcional } from '../../utils/numeros.ts';

// Dados do formulário do simulador: o que foi digitado, a conferência dos campos e o corpo enviado à API.

export const NAO_SEI = 'naoSei';

// Vazio significa ainda sem resposta. "Não sei" é uma resposta: não vai para a API, e o cálculo usa o valor típico.
type Resposta<Valor extends string> = Valor | typeof NAO_SEI | '';

export interface DadosDaSimulacao {
  cep: string;
  distribuidora: string;
  subgrupo: Subgrupo;
  tipoLigacao: TipoLigacao | '';
  // O mesmo número é o consumo do cálculo e o kWh da conta: o cliente o informa uma única vez.
  consumo: string;
  valorDaConta: string;
  iluminacao: string;
  meses: string[];
  perfil: Resposta<PerfilDeConsumo>;
  aumento: string;
  horasDeSol: Resposta<HorasDeSol>;
  orientacao: Resposta<Orientacao>;
  inclinacao: Resposta<Inclinacao>;
  tipoDeTelhado: Resposta<TipoDeTelhado>;
  area: string;
  jaTemSolar: Resposta<'sim' | 'nao'>;
  protocoloEm: string;
  pagamento: Resposta<TipoDePagamento>;
}

export const DADOS_VAZIOS: DadosDaSimulacao = {
  cep: '', distribuidora: '', subgrupo: 'B1', tipoLigacao: '', consumo: '', valorDaConta: '', iluminacao: '', meses: Array.from({ length: 12 }, () => ''),
  perfil: '', aumento: '', horasDeSol: '', orientacao: '', inclinacao: '', tipoDeTelhado: '', area: '', jaTemSolar: '', protocoloEm: '', pagamento: '',
};

// Trafega no estado do histórico entre o formulário e o resultado, para o cliente poder voltar e corrigir uma resposta.
export interface EstadoDoResultado {
  simulacao?: Simulacao;
  dados?: DadosDaSimulacao;
}

// As chaves são os caminhos usados pela API em `fields`: erros da tela e do backend aparecem no mesmo lugar.
export type ErrosDaSimulacao = Record<string, string>;

export const somenteNumeros = (texto: string) => texto.replace(/\D/g, '');

const hojeEmSaoPaulo = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function conferirImovel({ cep, distribuidora }: DadosDaSimulacao, local: LocalDoCep | null, erroDoCep?: string): ErrosDaSimulacao {
  const erros: ErrosDaSimulacao = {};
  if (somenteNumeros(cep).length !== 8) erros.cep = 'Informe o CEP com 8 números.';
  else if (!local) erros.cep = erroDoCep ?? 'Aguarde a busca da cidade.';
  else if (!local.atendido) erros.cep = 'Ainda não temos a tarifa da distribuidora desta cidade. Fale com a equipe pelo WhatsApp.';
  if (local?.escolhaNecessaria && !distribuidora) erros.distribuidora = 'Escolha a distribuidora que aparece na sua conta de luz.';
  return erros;
}

function conferirConta({ tipoLigacao, consumo, valorDaConta, iluminacao }: DadosDaSimulacao): ErrosDaSimulacao {
  const erros: ErrosDaSimulacao = {};
  if (!tipoLigacao) erros.tipoLigacao = 'Selecione o tipo de ligação.';
  const kwh = lerNumero(consumo);
  if (!(kwh >= 1)) erros.consumoMedioKwh = 'Informe o consumo em kWh (só números).';
  else if (kwh > 20_000) erros.consumoMedioKwh = 'O simulador aceita até 20.000 kWh por mês.';
  const valor = lerNumeroOpcional(valorDaConta);
  const publica = lerNumeroOpcional(iluminacao);
  if (valor !== undefined && !(valor >= 1 && valor <= 1_000_000)) erros['conta.valorReais'] = 'Informe o valor da conta em reais.';
  if (valor === undefined && publica !== undefined) erros['conta.valorReais'] = 'Para descontar a iluminação pública, informe o valor da conta.';
  if (valor !== undefined && publica !== undefined && !(publica >= 0 && publica < valor)) erros['conta.iluminacaoPublicaReais'] = 'A iluminação pública não pode passar do valor da conta.';
  return erros;
}

function conferirHistorico({ meses }: DadosDaSimulacao): ErrosDaSimulacao {
  const preenchidos = meses.filter((mes) => mes.trim() !== '');
  if (preenchidos.length === 0) return {};
  if (preenchidos.length < 12) return { consumoMensalKwh: `Faltam ${12 - preenchidos.length} mês(es). Preencha os 12 ou deixe todos em branco.` };
  const numeros = meses.map(lerNumero);
  if (numeros.some((mes) => !(mes >= 0 && mes <= 20_000))) return { consumoMensalKwh: 'Cada mês precisa ficar entre 0 e 20.000 kWh.' };
  if (numeros.reduce((soma, mes) => soma + mes, 0) < 12) return { consumoMensalKwh: 'A média dos 12 meses precisa ser de pelo menos 1 kWh.' };
  return {};
}

const faixaInvalida = (texto: string, minimo: number, maximo: number) => {
  const valor = lerNumeroOpcional(texto);
  return valor !== undefined && !(valor >= minimo && valor <= maximo);
};

function conferirFaixasEData({ aumento, area, jaTemSolar, protocoloEm }: DadosDaSimulacao): ErrosDaSimulacao {
  return {
    ...(faixaInvalida(aumento, 0, 5_000) && { aumentoPrevistoKwh: 'Informe um aumento de 0 a 5.000 kWh por mês.' }),
    ...(faixaInvalida(area, 1, 10_000) && { 'telhado.areaM2': 'Informe a área entre 1 e 10.000 m².' }),
    ...(jaTemSolar === 'sim' && protocoloEm > hojeEmSaoPaulo() && { 'solarExistente.protocoloEm': 'A data não pode estar no futuro.' }),
  };
}

const MARQUE_UMA_OPCAO = 'Marque uma opção. Se não souber, marque “Não sei”.';

// Nada vem marcado: a resposta é uma escolha consciente de quem mora na casa, mesmo quando é "não sei".
function conferirEscolhas(dados: DadosDaSimulacao): ErrosDaSimulacao {
  const escolhas: [string, string][] = [
    ['perfilDeConsumo', dados.perfil], ['telhado.horasDeSol', dados.horasDeSol], ['telhado.orientacao', dados.orientacao],
    ['telhado.inclinacao', dados.inclinacao], ['telhado.tipo', dados.tipoDeTelhado], ['jaTemSolar', dados.jaTemSolar], ['pagamentoPreferido', dados.pagamento],
  ];
  return Object.fromEntries(escolhas.filter(([, valor]) => !valor).map(([campo]) => [campo, MARQUE_UMA_OPCAO]));
}

// Conferência antes do envio, com as mesmas regras do backend, que valida de novo.
export function conferirDados(dados: DadosDaSimulacao, local: LocalDoCep | null, erroDoCep?: string): ErrosDaSimulacao {
  return {
    ...conferirImovel(dados, local, erroDoCep), ...conferirConta(dados), ...conferirHistorico(dados),
    ...conferirFaixasEData(dados), ...conferirEscolhas(dados),
  };
}

function respondida<Valor extends string>(resposta: Resposta<Valor>): Valor | undefined {
  return resposta === '' || resposta === NAO_SEI ? undefined : resposta;
}

function montarTelhado(dados: DadosDaSimulacao): PedidoDeSimulacao['telhado'] {
  const telhado = {
    ...(respondida(dados.horasDeSol) && { horasDeSol: respondida(dados.horasDeSol) }),
    ...(respondida(dados.orientacao) && { orientacao: respondida(dados.orientacao) }),
    ...(respondida(dados.inclinacao) && { inclinacao: respondida(dados.inclinacao) }),
    ...(respondida(dados.tipoDeTelhado) && { tipo: respondida(dados.tipoDeTelhado) }),
    ...(dados.area.trim() && { areaM2: lerNumero(dados.area) }),
  };
  return Object.keys(telhado).length > 0 ? telhado : undefined;
}

function montarConta(dados: DadosDaSimulacao): PedidoDeSimulacao['conta'] {
  const valorReais = lerNumeroOpcional(dados.valorDaConta);
  if (valorReais === undefined) return undefined;
  const iluminacao = lerNumeroOpcional(dados.iluminacao);
  return { valorReais, consumoKwh: lerNumero(dados.consumo), ...(iluminacao !== undefined && { iluminacaoPublicaReais: iluminacao }) };
}

// Apenas o que foi respondido vai para a API: "não sei" e campos em branco mantêm o valor típico no cálculo.
export function montarPedido(dados: DadosDaSimulacao): PedidoDeSimulacao {
  if (!dados.tipoLigacao) throw new Error('Tipo de ligação sem conferência.');
  const conta = montarConta(dados);
  const telhado = montarTelhado(dados);
  const perfilDeConsumo = respondida(dados.perfil);
  const pagamentoPreferido = respondida(dados.pagamento);
  return {
    cep: somenteNumeros(dados.cep), tipoLigacao: dados.tipoLigacao, subgrupo: dados.subgrupo, consumoMedioKwh: lerNumero(dados.consumo),
    ...(dados.distribuidora && { distribuidora: dados.distribuidora }),
    ...(conta && { conta }),
    ...(dados.meses.every((mes) => mes.trim() !== '') && { consumoMensalKwh: dados.meses.map(lerNumero) }),
    ...(perfilDeConsumo && { perfilDeConsumo }),
    ...(telhado && { telhado }),
    ...(dados.jaTemSolar === 'sim' && dados.protocoloEm && { solarExistente: { protocoloEm: dados.protocoloEm } }),
    ...(dados.aumento.trim() && { aumentoPrevistoKwh: lerNumero(dados.aumento) }),
    ...(pagamentoPreferido && { pagamentoPreferido }),
  };
}
