// Regras puras do módulo, sem banco nem relógio. As datas são texto 'AAAA-MM-DD':
// comparar e somar sem Date evita que o fuso mude o dia.
import type { RegimeGd } from '../../../motor/faturamento.ts';
import type { TipoEquipamentoDaUsina } from '../tipos.ts';

// Campo e mensagem; vazio significa que a regra foi cumprida.
export type CamposInvalidos = Record<string, string>;

// Lei 14.300: protocolo até esta data, inclusive, é GD I.
const ULTIMO_DIA_DO_GD_I = '2023-01-07';
// Limite do formato AAAA-MM-DD usado nas respostas; não é limite comercial de garantia.
const ULTIMO_ANO_DO_FORMATO_DE_DATA = 9999;
const MENSAGEM_DO_VENCIMENTO_FORA_DO_FORMATO = 'O vencimento desta garantia passa do ano 9999. Confira o valor.';

// Comparação de texto: o formato AAAA-MM-DD ordena como data.
export function calcularRegime(dataProtocolo: string): RegimeGd {
  return dataProtocolo <= ULTIMO_DIA_DO_GD_I ? 'GD_I' : 'GD_II';
}

// Ano divisível por 100 só é bissexto se também for divisível por 400.
function ultimoDiaDoMes(ano: number, mes: number): number {
  const anoBissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  if (mes === 2) return anoBissexto ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

// Se o dia não existe no mês final (31/01 + 1 mês), vale o último dia desse mês.
export function calcularVencimento(dataInstalacao: string, meses: number): string {
  const [ano, mes, dia] = dataInstalacao.split('-').map(Number);
  const totalDeMeses = ano * 12 + (mes - 1) + meses;
  const anoFinal = Math.floor(totalDeMeses / 12);
  const mesFinal = (totalDeMeses % 12) + 1;
  const diaFinal = Math.min(dia, ultimoDiaDoMes(anoFinal, mesFinal));
  return `${String(anoFinal).padStart(4, '0')}-${String(mesFinal).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
}

// O mesmo dia é aceito: só conexão anterior ao protocolo é recusada.
export function conferirDatasDaUsina(dataProtocolo: string, dataConexao: string): CamposInvalidos {
  return dataConexao < dataProtocolo ? { dataConexao: 'A data de conexão não pode ser anterior à data de protocolo.' } : {};
}

// Módulo exige a garantia de desempenho, e inversor a recusa. null e undefined contam como não informada.
export function conferirGarantiaDeDesempenho(tipo: TipoEquipamentoDaUsina, garantiaDesempenhoAnos: number | null | undefined): CamposInvalidos {
  const informada = (garantiaDesempenhoAnos ?? null) !== null;
  if (tipo === 'modulo' && !informada) return { garantiaDesempenhoAnos: 'Informe a garantia de desempenho do módulo.' };
  if (tipo === 'inversor' && informada) return { garantiaDesempenhoAnos: 'Só módulo tem garantia de desempenho.' };
  return {};
}

// Confere o ano do vencimento já calculado, que pode passar de 4 dígitos.
function vencimentoPassaDoFormato(dataInstalacao: string, meses: number): boolean {
  const [ano] = calcularVencimento(dataInstalacao, meses).split('-');
  return Number(ano) > ULTIMO_ANO_DO_FORMATO_DE_DATA;
}

// Cada garantia responde no próprio campo; a de desempenho conta em anos e é convertida em meses.
export function conferirVencimentosDasGarantias(dataInstalacao: string, garantiaProdutoMeses: number, garantiaDesempenhoAnos: number | null | undefined): CamposInvalidos {
  const desempenhoPassa = typeof garantiaDesempenhoAnos === 'number' && vencimentoPassaDoFormato(dataInstalacao, garantiaDesempenhoAnos * 12);
  return {
    ...(vencimentoPassaDoFormato(dataInstalacao, garantiaProdutoMeses) && { garantiaProdutoMeses: MENSAGEM_DO_VENCIMENTO_FORA_DO_FORMATO }),
    ...(desempenhoPassa && { garantiaDesempenhoAnos: MENSAGEM_DO_VENCIMENTO_FORA_DO_FORMATO }),
  };
}
