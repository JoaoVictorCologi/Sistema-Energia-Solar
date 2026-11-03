// Seção 2 da especificação: potência, número de módulos e escolha do inversor.
import { Decimal } from 'decimal.js';
import { kwp, type Alerta, type Fracao, type Kwh, type Kwp } from './tipos.ts';

// Ano não bissexto: o dimensionamento usa 365 dias.
const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// Razão CC/CA (kWp ÷ potência CA do inversor): faixa de boa prática e limite de perda por ceifamento.
const RAZAO_MINIMA = new Decimal('1.15');
const RAZAO_MAXIMA = new Decimal('1.35');
const RAZAO_DE_CEIFAMENTO = new Decimal('1.40');

export interface EntradaDimensionamento {
  // 12 valores, de janeiro a dezembro.
  consumoMensal: Kwh[];
  hspMensal: Decimal[];
  performanceRatio: Fracao;
  coberturaAlvo: Fracao;
  potenciaModuloW: Decimal;
  inversoresKw: Decimal[];
}

export interface Dimensionamento {
  kwpAlvo: Kwp;
  numeroModulos: number;
  kwpInstalado: Kwp;
  inversorKw: Decimal | null;
  razaoCcCa: Decimal | null;
  alertas: Alerta[];
}

function distanciaDaFaixa(razao: Decimal): Decimal {
  if (razao.lt(RAZAO_MINIMA)) return RAZAO_MINIMA.minus(razao);
  if (razao.gt(RAZAO_MAXIMA)) return razao.minus(RAZAO_MAXIMA);
  return new Decimal(0);
}

// O menor inversor com a razão na faixa; sem nenhum, o de razão mais próxima da faixa (com alerta).
function escolherInversor(potencia: Kwp, inversoresKw: Decimal[]): Pick<Dimensionamento, 'inversorKw' | 'razaoCcCa' | 'alertas'> {
  if (inversoresKw.length === 0) {
    return { inversorKw: null, razaoCcCa: null, alertas: [{ codigo: 'SEM_INVERSOR_COMPATIVEL', mensagem: 'Nenhum inversor disponível para esta potência.' }] };
  }
  const opcoes = [...inversoresKw]
    .sort((a, b) => a.comparedTo(b))
    .map((inversorKw) => ({ inversorKw, razaoCcCa: potencia.div(inversorKw) }));
  const escolhida = opcoes.reduce((melhor, opcao) => (distanciaDaFaixa(opcao.razaoCcCa).lt(distanciaDaFaixa(melhor.razaoCcCa)) ? opcao : melhor));

  const alertas: Alerta[] = [];
  if (!distanciaDaFaixa(escolhida.razaoCcCa).isZero()) {
    alertas.push({ codigo: 'RAZAO_CC_CA_FORA_DA_FAIXA', mensagem: `Razão CC/CA de ${escolhida.razaoCcCa.toDecimalPlaces(2)}, fora da faixa de 1,15 a 1,35.` });
  }
  if (escolhida.razaoCcCa.gt(RAZAO_DE_CEIFAMENTO)) {
    alertas.push({ codigo: 'CEIFAMENTO', mensagem: 'Razão CC/CA acima de 1,40: parte da geração nos horários de pico se perde no inversor.' });
  }
  return { ...escolhida, alertas };
}

// kWp alvo = cobertura × consumo anual ÷ (PR × Σ HSP × dias); módulos arredondados para cima.
export function dimensionar(entrada: EntradaDimensionamento): Dimensionamento {
  const consumoAnual = Decimal.sum(...entrada.consumoMensal);
  const horasDeSolNoAno = Decimal.sum(...entrada.hspMensal.map((hsp, indice) => hsp.times(DIAS_POR_MES[indice])));
  const kwpAlvo = kwp(entrada.coberturaAlvo.times(consumoAnual).div(entrada.performanceRatio.times(horasDeSolNoAno)));
  const numeroModulos = kwpAlvo.times(1000).div(entrada.potenciaModuloW).ceil().toNumber();
  const kwpInstalado = kwp(entrada.potenciaModuloW.times(numeroModulos).div(1000));
  return { kwpAlvo, numeroModulos, kwpInstalado, ...escolherInversor(kwpInstalado, entrada.inversoresKw) };
}
