// Configurações comerciais e formas de pagamento, editadas no painel.
// Orçamento já emitido guarda a cópia dos valores que usou: mudar aqui só vale para os próximos.
import { ErroHttp } from '../middlewares/erros.ts';
import {
  atualizarFormaDePagamento, buscarConfiguracaoComercial, buscarFormaDePagamento, inserirFormaDePagamento, listarFormasDePagamento,
  registrarConfiguracaoComercial, type ConfiguracaoVigente, type DadosDaForma, type FormaDePagamento,
} from '../repositories/configuracoesRepository.ts';

function comoConfiguracaoDaApi(configuracao: ConfiguracaoVigente) {
  return {
    margem: configuracao.margem.toNumber(), instalacaoPorKwp: configuracao.instalacaoPorKwp.toNumber(),
    custoReferenciaPorKwp: configuracao.custoReferenciaPorKwp.toNumber(), validadeDias: configuracao.validadeDias,
    limiteDesconto: configuracao.limiteDesconto.toNumber(), alteradoEm: configuracao.alteradoEm,
  };
}

export function comoFormaDaApi(forma: FormaDePagamento) {
  return {
    id: forma.id, tipo: forma.tipo, nome: forma.nome, taxaMensal: forma.taxaMensal?.toNumber() ?? null, parcelasMinimas: forma.parcelasMinimas,
    parcelasMaximas: forma.parcelasMaximas, entradaMinima: forma.entradaMinima.toNumber(), carenciaMaximaDias: forma.carenciaMaximaDias,
    descontoAvista: forma.descontoAvista.toNumber(), ativa: forma.ativa,
  };
}

export async function obterConfiguracaoVigente(): Promise<ConfiguracaoVigente> {
  const configuracao = await buscarConfiguracaoComercial();
  if (!configuracao) throw new Error('Sem configuração comercial: rode npm run db:migrate.');
  return configuracao;
}

export async function consultarConfiguracao() {
  return comoConfiguracaoDaApi(await obterConfiguracaoVigente());
}

export async function alterarConfiguracao(mudanca: Partial<Omit<ConfiguracaoVigente, 'alteradoEm'>>, usuarioId: number) {
  await registrarConfiguracaoComercial({ ...await obterConfiguracaoVigente(), ...mudanca }, usuarioId);
  return consultarConfiguracao();
}

export async function consultarFormas(somenteAtivas = false) {
  return (await listarFormasDePagamento(somenteAtivas)).map(comoFormaDaApi);
}

// Vale para a forma inteira, depois de juntar a mudança com o que já estava gravado.
function conferirForma(forma: DadosDaForma): void {
  const problemas: Record<string, string> = {};
  if (forma.tipo === 'avista' && forma.parcelasMaximas !== 1) problemas.parcelasMaximas = 'À vista tem uma parcela só.';
  if (forma.tipo !== 'avista' && forma.ativa && forma.taxaMensal === null) problemas.taxaMensal = 'Preencha a taxa ao mês para ativar esta forma (zero para sem juros).';
  if (forma.parcelasMinimas > forma.parcelasMaximas) problemas.parcelasMinimas = 'O mínimo de parcelas não pode passar do máximo.';
  if (Object.keys(problemas).length > 0) throw new ErroHttp(400, 'ENTRADA_INVALIDA', 'Dados inválidos. Confira os campos.', problemas);
}

function nomeRepetido(): ErroHttp {
  return new ErroHttp(409, 'FORMA_DUPLICADA', 'Já existe uma forma de pagamento com este nome.');
}

export async function cadastrarForma(dados: DadosDaForma, usuarioId: number) {
  conferirForma(dados);
  const forma = await inserirFormaDePagamento(dados, usuarioId);
  if (!forma) throw nomeRepetido();
  return comoFormaDaApi(forma);
}

export async function alterarForma(id: number, mudanca: Partial<DadosDaForma>, usuarioId: number) {
  const atual = await buscarFormaDePagamento(id);
  if (!atual) throw new ErroHttp(404, 'FORMA_NAO_ENCONTRADA', 'Forma de pagamento não encontrada.');
  const dados = { ...atual, ...mudanca };
  conferirForma(dados);
  const forma = await atualizarFormaDePagamento(id, dados, usuarioId);
  if (!forma) throw nomeRepetido();
  return comoFormaDaApi(forma);
}
